"use client"

import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Camera, Upload, Sparkles, Loader2 } from "lucide-react"

interface FoodPhotoUploadProps {
  onRecord: (data: {
    foodName: string
    mealType: string
    calories: number
    proteinG: number
    fatG: number
    carbsG: number
    portionDesc: string
    imageData?: string
  }) => void
  disabled?: boolean
}

export function FoodPhotoUpload({ onRecord, disabled }: FoodPhotoUploadProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("图片大小不能超过 10MB")
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      setAnalyzing(true)

      try {
        const res = await fetch("/api/ai/recognize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        })
        const json = await res.json()

        if (json.error) {
          toast.error("识别失败: " + json.error)
          return
        }

        const result = json.data
        if (!result?.foods?.length) {
          toast.error("未能识别出食物，请手动输入")
          return
        }

        const food = result.foods[0]
        onRecord({
          foodName: food.name,
          mealType: "breakfast",
          calories: Math.round(food.calories),
          proteinG: food.protein,
          fatG: food.fat,
          carbsG: food.carbs,
          portionDesc: food.portion,
          imageData: dataUrl,
        })
        setPreview(null)
        toast.success(`识别结果: ${food.name}, ${Math.round(food.calories)} 千卡`)
      } catch (e) {
        toast.error("识别请求失败: " + (e instanceof Error ? e.message : String(e)))
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [onRecord])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="space-y-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-24 flex-col gap-1"
          disabled={disabled || analyzing}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">选择图片</span>
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-24 flex-col gap-1"
          disabled={disabled || analyzing}
          onClick={() => cameraInputRef.current?.click()}
        >
          <Camera className="h-5 w-5" />
          <span className="text-xs">拍照</span>
        </Button>
      </div>

      {preview && (
        <div className="relative rounded-lg overflow-hidden border">
          <img src={preview} alt="食物预览" className="w-full h-48 object-cover" />
          {analyzing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p className="text-sm">AI 识别中...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {!preview && !analyzing && (
        <div className="rounded-lg border-2 border-dashed border-neutral-200 p-8 text-center">
          <Sparkles className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm text-neutral-400">上传食物照片，AI 自动识别营养成分</p>
          <p className="text-xs text-neutral-300 mt-1">支持 jpg/png/webp，最大 10MB</p>
        </div>
      )}
    </div>
  )
}
