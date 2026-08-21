"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Capacitor } from "@capacitor/core"
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera"
import { Camera as CameraIcon, ImagePlus, Loader2, ShieldCheck, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  beginRecognitionHandoff,
  clearRecognitionHandoff,
  createRecognitionRequestId,
  publishRecognitionHandoff,
  type RecognizedFood,
} from "@/lib/food/recognition-handoff"

export type { RecognizedFood } from "@/lib/food/recognition-handoff"

interface FoodPhotoUploadProps {
  onRecognized: (foods: RecognizedFood[]) => void
  onManualEntryRequested: () => void
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function cameraDataUrlToFile(dataUrl: string, format: string) {
  const separator = dataUrl.indexOf(",")
  if (separator < 0) throw new Error("相机返回的图片无效")

  const metadata = dataUrl.slice(0, separator)
  const payload = dataUrl.slice(separator + 1)
  const mimeType = metadata.match(/^data:(.*?);base64$/)?.[1] ?? `image/${format || "jpeg"}`
  const binary = atob(payload)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new File([bytes], `camera.${format || "jpeg"}`, { type: mimeType })
}

export function FoodPhotoUpload({ onRecognized, onManualEntryRequested, disabled }: FoodPhotoUploadProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const latestRequestIdRef = useRef<string | null>(null)

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

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

    const requestId = createRecognitionRequestId()
    latestRequestIdRef.current = requestId
    beginRecognitionHandoff(requestId)

    const reader = new FileReader()
    reader.onerror = () => {
      clearRecognitionHandoff(requestId)
      toast.error("图片读取失败，请手动录入")
      openManualEntry()
    }
    reader.onload = async (event) => {
      const image = event.target?.result
      if (typeof image !== "string") {
        clearRecognitionHandoff(requestId)
        toast.error("图片读取失败，请手动录入")
        openManualEntry()
        return
      }

      if (mountedRef.current) {
        setPreview(image)
        setAnalyzing(true)
      }

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
          clearRecognitionHandoff(requestId)
          toast.error("未识别出食物，已打开手动录入")
          openManualEntry()
          return
        }

        if (!publishRecognitionHandoff(requestId, foods)) return
        if (mountedRef.current) {
          onRecognized(foods)
          clearRecognitionHandoff(requestId)
          setPreview(null)
        }
        toast.success(`已加入 ${foods.length} 项待审核食物`)
      } catch (error) {
        clearRecognitionHandoff(requestId)
        toast.error(error instanceof Error ? `识别失败：${error.message}` : "识别失败，已打开手动录入")
        openManualEntry()
      } finally {
        if (mountedRef.current && latestRequestIdRef.current === requestId) setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [onRecognized, openManualEntry])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (file) void processFile(file)
  }

  const handleCameraCapture = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      cameraInputRef.current?.click()
      return
    }

    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        width: 2048,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        correctOrientation: true,
      })
      if (!photo.dataUrl) throw new Error("相机没有返回图片")
      void processFile(cameraDataUrlToFile(photo.dataUrl, photo.format ?? "jpeg"))
    } catch (error) {
      if (error instanceof Error && /cancel|canceled|cancelled/i.test(error.message)) return
      toast.error(error instanceof Error ? `相机不可用：${error.message}` : "无法打开相机，请检查权限")
    }
  }, [processFile])

  return (
    <div className="space-y-3">
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
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {preview && (
        <div className="relative min-h-[360px] overflow-hidden rounded-lg border sm:min-h-[520px]">
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
        <div className="relative min-h-[360px] overflow-hidden rounded-lg sm:min-h-[520px]">
          <Image
            src="/images/nutrition/meal-hero.webp"
            alt="三文鱼、牛油果和蔬菜组成的健康餐"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 58vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-4 bottom-4 rounded-md bg-[var(--brand-plum)]/94 p-4 text-white backdrop-blur sm:inset-x-5 sm:bottom-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--brand-mint)] text-[var(--brand-plum)]">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">让 AI 先看一眼，再由你确认。</p>
                <p className="mt-1 text-xs leading-5 text-white/60">支持 JPEG、PNG、WebP，最大 10MB；原图只用于本次识别。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 bg-card"
          disabled={disabled || analyzing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          选择图片
        </Button>
        <Button
          type="button"
          className="h-11 gap-2 bg-[var(--brand-mint)] text-[var(--brand-plum)] hover:bg-[var(--brand-mint)]/90"
          disabled={disabled || analyzing}
          onClick={() => void handleCameraCapture()}
        >
          <CameraIcon className="size-4" />
          立即拍照
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5 text-[var(--brand-mint-deep)]" />图片不会随记录保存</span>
        <span className="flex items-center gap-1.5"><ImagePlus className="size-3.5" />最多审核 10 项</span>
      </div>
    </div>
  )
}
