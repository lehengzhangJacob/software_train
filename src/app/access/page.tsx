"use client"

import { Lock } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Shared-passcode entry page for the cloud instance (ADR-0007). The page is
// intentionally outside the app shell: unauthenticated visitors see nothing
// but this card.
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
    <main className="flex min-h-dvh items-center justify-center px-6">
      <section className="surface-card w-full max-w-sm p-8" aria-label="访问验证">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--brand-mint-soft)] text-[var(--brand-mint-ink)]">
          <Lock className="size-6" aria-hidden="true" />
        </div>
        <p className="page-eyebrow mt-6 text-center">Access</p>
        <h1 className="mt-1 text-center text-xl font-semibold text-[var(--brand-heading)]">访问验证</h1>
        <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
          此服务由共享访问码保护，请输入访问码继续。
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-[var(--brand-coral-ink)]">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending || code.length === 0}>
            {pending ? "验证中…" : "进入"}
          </Button>
        </form>
      </section>
    </main>
  )
}
