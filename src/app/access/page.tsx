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
      <header className="flex items-center gap-3 border-b border-border/70 pb-5" aria-label="产品信息">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--brand-mint)] p-1 shadow-[0_8px_20px_rgba(40,214,155,0.18)]">
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
        className="surface-card mt-7 grid overflow-hidden lg:mt-9 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
        aria-label="进入私人营养空间"
      >
        <div className="relative isolate overflow-hidden bg-[var(--brand-plum)] px-6 py-6 text-white sm:px-10 sm:py-9 lg:flex lg:min-h-[310px] lg:flex-col lg:justify-between lg:px-12 lg:py-10">
          <Image
            src="/images/nutrition/meal-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-center opacity-60 saturate-[0.82]"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(105deg,rgba(45,39,53,0.95)_0%,rgba(45,39,53,0.84)_52%,rgba(45,39,53,0.62)_100%)]"
            aria-hidden="true"
          />
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium text-white/55">
              <span className="size-2 rounded-full bg-[var(--brand-mint)]" aria-hidden="true" />
              <span>私人营养空间</span>
            </div>
            <h1 className="mt-5 max-w-md text-2xl font-semibold leading-tight tracking-[-0.025em] sm:mt-8 sm:text-[clamp(2rem,4vw,3.2rem)] sm:leading-[1.08]">
              回到你的营养节奏。
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/65 sm:mt-4 sm:leading-7 sm:text-base">
              饮食、运动和对话，都从这里继续。
            </p>
          </div>
          <div className="relative z-10 mt-6 flex items-center gap-3 text-xs text-white/45 sm:mt-8 lg:mt-10">
            <span className="h-px w-8 bg-[var(--brand-mint)]" aria-hidden="true" />
            <span>记录 · 复盘 · 调整</span>
          </div>
        </div>

        <div className="bg-card p-6 sm:p-10 lg:flex lg:flex-col lg:justify-center lg:p-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="page-eyebrow">欢迎回来</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--brand-heading)] sm:text-3xl">
                输入访问码
              </h2>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            验证后，回到你的饮食与运动记录。
          </p>
          <form className="mt-7 space-y-5" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="access-code" className="text-[var(--brand-heading)]">
                访问码
              </Label>
              <Input
                id="access-code"
                type="password"
                autoComplete="current-password"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                aria-invalid={error ? true : undefined}
                placeholder="输入授权访问码"
                className="h-12 bg-[var(--brand-paper)] tracking-[0.22em] placeholder:tracking-normal"
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

      <p className="mt-4 text-center text-xs text-muted-foreground">
        访问码仅用于进入此服务，不会保存到页面
      </p>
    </div>
  )
}
