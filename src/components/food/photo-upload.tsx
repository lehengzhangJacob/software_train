"use client"

import { useCallback, useRef, useState } from "react"
import Image from "next/image"
import { Camera, Loader2, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export interface RecognizedFood {
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  portion: string
  confidence: number
}

interface FoodPhotoUploadProps {
  onRecognized: (foods: RecognizedFood[]) => void
  onManualEntryRequested: () => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function FoodPhotoUpload({ onRecognized, onManualEntryRequested, disabled }: FoodPhotoUploadProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const openManualEntry = useCallback(() => {
    setPreview(null)
    onManualEntryRequested()
  }, [onManualEntryRequested])

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast.error("仅支持 JPEG、PNG 或 WebP 图片")
      openManualEntry()
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("图片大小不能超过 10MB")
      openManualEntry()
      return
    }

    const reader = new FileReader()
    reader.onerror = () => {
      toast.error("图片读取失败，请手动录入")
      openManualEntry()
    }
    reader.onload = async (event) => {
      const image = event.target?.result
      if (typeof image !== "string") {
        toast.error("图片读取失败，请手动录入")
        openManualEntry()
        return
      }

      setPreview(image)
      setAnalyzing(true)

      try {
        const response = await fetch("/api/ai/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image }),
        })
        const json: { data?: { foods?: RecognizedFood[] } | null; error?: string | null } = await response.json()

        if (!response.ok || json.error) {
          throw new Error(json.error || "AI 识别服务暂时不可用")
        }

        const foods = json.data?.foods ?? []
        if (foods.length === 0) {
          toast.error("未识别出食物，已打开手动录入")
          openManualEntry()
          return
        }

        onRecognized(foods)
        setPreview(null)
        toast.success(`已加入 ${foods.length} 项待审核食物`)
      } catch (error) {
        toast.error(error instanceof Error ? `识别失败：${error.message}` : "识别失败，已打开手动录入")
        openManualEntry()
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [onRecognized, openManualEntry])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) void processFile(file)
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-1 flex-col gap-1"
          disabled={disabled || analyzing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">选择图片</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-24 flex-1 flex-col gap-1"
          disabled={disabled || analyzing}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-5 w-5" />
          <span className="text-xs">拍照</span>
        </Button>
      </div>

      {preview && (
        <div className="relative h-48 overflow-hidden rounded-lg border">
          <Image src={preview} alt="待识别的食物照片" fill unoptimized sizes="(max-width: 640px) 100vw, 42rem" className="object-cover" />
          {analyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-center text-white">
                <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
                <p className="text-sm">AI 正在识别...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!preview && !analyzing && (
        <div className="border-2 border-dashed border-neutral-200 p-8 text-center">
          <Sparkles className="mx-auto mb-2 h-8 w-8 text-neutral-300" />
          <p className="text-sm text-neutral-500">上传食物照片，AI 会识别每一项食物供你审核</p>
          <p className="mt-1 text-xs text-neutral-400">支持 JPEG、PNG、WebP，最大 10MB</p>
        </div>
      )}
    </div>
  )
}
