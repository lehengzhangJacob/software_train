"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type AuthMode = "login" | "register"

type AuthForm = {
  username: string
  login: string
  password: string
  confirmPassword: string
  inviteCode: string
}

type ApiResponse = {
  error?: string | null
}

const initialForm: AuthForm = {
  username: "",
  login: "",
  password: "",
  confirmPassword: "",
  inviteCode: "",
}

function getErrorMessage(payload: ApiResponse | null, fallback: string) {
  return payload?.error?.trim() || fallback
}

export default function AccessPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")
  const [form, setForm] = useState<AuthForm>(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function updateField(field: keyof AuthForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }))
    if (error) setError(null)
  }

  function switchMode(nextMode: AuthMode) {
    if (pending || mode === nextMode) return
    setMode(nextMode)
    setError(null)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    if (mode === "register" && form.password !== form.confirmPassword) {
      setError("两次输入的密码不一致")
      return
    }

    setPending(true)
    setError(null)

    try {
      const body = mode === "register"
        ? {
            username: form.username,
            login: form.login,
            password: form.password,
            inviteCode: form.inviteCode,
          }
        : {
            login: form.login,
            password: form.password,
          }
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as ApiResponse | null

      if (response.ok) {
        router.replace("/dashboard")
        router.refresh()
        return
      }

      setError(getErrorMessage(payload, mode === "register" ? "注册没有完成，请检查邀请码" : "账号或密码不正确"))
    } catch {
      setError("网络暂时不可用，请稍后重试")
    } finally {
      setPending(false)
    }
  }

  const isRegister = mode === "register"

  return (
    <div className="access-page-content w-full">
      <header className="access-brandbar flex items-center gap-3 border-b border-border/70 pb-4" aria-label="产品信息">
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
          <p className="text-sm font-semibold text-[var(--brand-heading)]">食刻</p>
          <p className="text-xs text-muted-foreground">记录每一餐，照顾每一天</p>
        </div>
      </header>

      <section
        className="access-hero relative isolate mt-6 overflow-hidden border-y border-border/70 bg-[var(--brand-plum)] text-white shadow-[0_22px_65px_rgba(45,39,53,0.14)] lg:mt-6 lg:grid lg:h-[min(620px,calc(100dvh-170px))] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        aria-label="进入食刻"
      >
        <div className="relative isolate flex min-h-[330px] flex-col justify-between overflow-hidden px-6 py-7 sm:px-10 sm:py-9 lg:min-h-0 lg:px-12 lg:py-10">
          <Image
            src="/images/nutrition/meal-hero.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 43vw, 100vw"
            className="access-photo object-cover object-center opacity-65 saturate-[0.82]"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(145deg,rgba(45,39,53,0.98)_0%,rgba(45,39,53,0.82)_52%,rgba(45,39,53,0.48)_100%)]"
            aria-hidden="true"
          />
          <div className="access-hero-copy relative z-10">
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.12em] text-white/60">
              <span className="size-2 rounded-full bg-[var(--brand-mint)]" aria-hidden="true" />
              <span>食刻 · 个人营养空间</span>
            </div>
            <h1 className="mt-6 max-w-md text-3xl font-semibold leading-[1.08] tracking-[-0.035em] sm:mt-10 sm:text-[clamp(2.4rem,4.5vw,4.5rem)]">
              把每一餐，记成自己的节奏。
            </h1>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/68 sm:text-base">
              饮食、运动和对话，从同一个空间继续。你的记录会跟着账户走，在每一次打开时回到身边。
            </p>
          </div>
          <div className="access-hero-stats relative z-10 mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-white/18 pt-5 text-xs text-white/60">
            <div>
              <p className="text-lg font-semibold text-white">01</p>
              <p className="mt-1">记录饮食</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">02</p>
              <p className="mt-1">理解身体</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-white">03</p>
              <p className="mt-1">一起调整</p>
            </div>
          </div>
        </div>

        <div className="access-auth-panel relative min-h-0 overflow-y-auto bg-[color-mix(in_srgb,var(--brand-paper)_94%,transparent)] px-6 py-8 text-[var(--brand-heading)] backdrop-blur sm:px-10 sm:py-10 lg:border-l lg:border-white/10 lg:px-10 lg:py-8">
          <div className="access-auth-heading flex items-end justify-between gap-5 border-b border-border/80 pb-5 lg:pb-4">
            <div>
              <p className="page-eyebrow">{isRegister ? "第一次来到这里" : "欢迎回来"}</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                {isRegister ? "建立你的空间" : "进入你的空间"}
              </h2>
            </div>
            <span className="hidden text-right text-xs leading-5 text-muted-foreground sm:block">
              账户登录后
              <br />
              记录会自动同步
            </span>
          </div>

          <div className="access-tabs mt-5 flex items-center gap-5 border-b border-border/70 lg:mt-4" role="tablist" aria-label="账户操作">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                onClick={() => switchMode(item)}
                className={`relative -mb-px px-1 pb-3 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint-deep)] focus-visible:ring-offset-2 ${
                  mode === item
                    ? "text-[var(--brand-heading)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[var(--brand-mint-deep)]"
                    : "text-muted-foreground hover:text-[var(--brand-heading)]"
                }`}
              >
                {item === "login" ? "登录" : "邀请码注册"}
              </button>
            ))}
          </div>

          <p className="access-auth-copy mt-5 max-w-md text-sm leading-6 text-muted-foreground lg:mt-4">
            {isRegister
              ? "用注册邀请码创建账户。之后，饮食记录、长期记忆和工具配置都归属于你的空间。"
              : "登录后继续记录饮食、运动，也可以直接和营养教练聊天。"}
          </p>

          <form className="access-auth-form mt-7 space-y-4 lg:mt-5 lg:grid lg:grid-cols-2 lg:gap-x-5 lg:gap-y-3 lg:space-y-0" onSubmit={onSubmit}>
            {isRegister ? (
              <div className="space-y-2">
                <Label htmlFor="auth-username" className="text-[var(--brand-heading)]">显示名称</Label>
                <Input
                  id="auth-username"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={60}
                  value={form.username}
                  onChange={(event) => updateField("username", event.target.value)}
                  placeholder="例如：张三"
                  className="h-12 bg-white/75 lg:h-11"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="auth-login" className="text-[var(--brand-heading)]">账号</Label>
              <Input
                id="auth-login"
                type="text"
                autoComplete="username"
                required
                minLength={3}
                maxLength={80}
                value={form.login}
                onChange={(event) => updateField("login", event.target.value)}
                placeholder="输入你的登录账号"
                className="h-12 bg-white/75 lg:h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password" className="text-[var(--brand-heading)]">密码</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                minLength={isRegister ? 8 : 1}
                maxLength={128}
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
                placeholder={isRegister ? "至少 8 位" : "输入账户密码"}
                className="h-12 bg-white/75 lg:h-11"
              />
            </div>

            {isRegister ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="auth-confirm-password" className="text-[var(--brand-heading)]">确认密码</Label>
                  <Input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={form.confirmPassword}
                    onChange={(event) => updateField("confirmPassword", event.target.value)}
                    placeholder="再输入一次密码"
                    className="h-12 bg-white/75 lg:h-11"
                  />
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="auth-invite-code" className="text-[var(--brand-heading)]">注册邀请码</Label>
                  <Input
                    id="auth-invite-code"
                    type="password"
                    autoComplete="one-time-code"
                    required
                    minLength={4}
                    maxLength={128}
                    value={form.inviteCode}
                    onChange={(event) => updateField("inviteCode", event.target.value)}
                    placeholder="输入收到的邀请码"
                    className="h-12 bg-white/75 tracking-[0.12em] placeholder:tracking-normal lg:h-11"
                  />
                </div>
              </>
            ) : null}

            {error ? (
              <p role="alert" className="border-l-2 border-[var(--brand-coral)] bg-[var(--brand-coral-soft)] px-3 py-2 text-sm leading-6 text-[var(--brand-coral-ink)] lg:col-span-2">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="mt-2 h-12 w-full bg-[var(--brand-plum)] text-white hover:bg-[var(--brand-plum-soft)] lg:col-span-2 lg:mt-0 lg:h-11"
              disabled={pending || form.login.trim().length < 3 || form.password.length === 0 || (isRegister && (!form.username.trim() || !form.inviteCode.trim()))}
            >
              {pending ? "正在处理…" : isRegister ? "创建我的空间" : "登录并继续"}
            </Button>
          </form>
        </div>
      </section>

      <p className="access-security-note mt-3 text-center text-xs leading-5 text-muted-foreground">
        账户用于区分你的记录与配置；密码只以不可逆摘要保存。
      </p>
    </div>
  )
}
