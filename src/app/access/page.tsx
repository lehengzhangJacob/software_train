"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Shared-passcode entry page for the cloud instance (ADR-0007). Unauthenticated
// visitors get the product's entry rhythm without seeing app navigation.
export default function AccessPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const payload = (await response.json().catch(() => null)) as { error?: string | null } | null
      if (response.ok) {
        router.replace("/")
        router.refresh()
        return
      }
      setError(payload?.error ?? "访问码不正确")
    } catch {
      setError("网络异常，请重试")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="w-full">
      <header className="flex items-center gap-3" aria-label="产品信息">
        <span className="grid size-10 place-items-center rounded-md bg-[var(--brand-mint)] p-1">
          <Image
            src="/brand/nutrition-agent-icon.png"
            alt=""
            width={32}
            height={32}
            className="size-full rounded-[5px] object-cover"
          />
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--brand-heading)]">营养 Agent</p>
          <p className="text-xs text-muted-foreground">你的私人营养空间</p>
        </div>
      </header>

      <section
        className="mt-8 grid overflow-hidden border-y border-border bg-card lg:mt-12 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:rounded-lg lg:border"
        aria-label="进入私人营养空间"
      >
        <div className="brand-panel p-6 sm:p-10 lg:p-12">
          <div className="grid size-16 place-items-center rounded-lg bg-[var(--brand-mint)] p-1">
            <Image
              src="/brand/nutrition-agent-icon.png"
              alt=""
              width={56}
              height={56}
              className="size-full rounded-md object-cover"
            />
          </div>
          <p className="page-eyebrow mt-10 text-[var(--brand-mint)]">私人营养空间</p>
          <h1 className="mt-3 max-w-sm text-3xl font-semibold leading-tight text-white sm:text-4xl">
            回来继续照顾自己。
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/65">
            饮食、运动和对话，从今天继续。每一次记录，都会让你的节奏更清晰。
          </p>
          <p className="mt-10 max-w-sm border-l-2 border-[var(--brand-mint)] pl-4 text-xs leading-6 text-white/55">
            访问码只负责保护这套服务，不会改变你的记录，也不会把密钥交给浏览器。
          </p>
        </div>

        <div className="p-6 sm:p-10 lg:p-12">
          <p className="page-eyebrow">继续使用</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--brand-heading)]">输入访问码</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            验证后，回到你的饮食与运动记录。
          </p>
          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="access-code">访问码</Label>
              <Input
                id="access-code"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                aria-invalid={error ? true : undefined}
                className="h-12"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-[var(--brand-coral-ink)]">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-11 w-full bg-[var(--brand-plum)] text-white hover:bg-[var(--brand-plum-soft)]"
              disabled={pending || code.length === 0}
            >
              {pending ? "正在进入…" : "进入空间"}
            </Button>
          </form>
        </div>
      </section>

      <p className="mt-5 text-center text-xs text-muted-foreground">仅限授权用户使用 · 访问码不会保存到页面</p>
    </div>
  )
}
