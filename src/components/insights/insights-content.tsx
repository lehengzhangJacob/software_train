"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, Bookmark, Check, EyeOff, ImageIcon, LoaderCircle, RefreshCcw, Sparkles } from "lucide-react"
import { ArticleVisualBlock } from "@/components/insights/article-visual"
import type { DailyArticleFeed, ArticleView } from "@/lib/agent/content/repository"
import { cn } from "@/lib/utils"

type Props = {
  initialFeed: DailyArticleFeed | null
  username: string
  date: string
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-")
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`
}

function ArticleCover({ article, compact = false }: { article: ArticleView; compact?: boolean }) {
  if (article.imageUrl) {
    return (
      <div className={cn("relative overflow-hidden rounded-md bg-muted", compact ? "aspect-[1.35/1]" : "aspect-[1.55/1]")}>
        <Image src={article.imageUrl} alt={article.imageAlt} fill unoptimized sizes={compact ? "(max-width: 768px) 100vw, 30vw" : "(max-width: 768px) 100vw, 45vw"} className="object-cover" />
        {article.imageStatus !== "ready" ? <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-sm bg-black/55 px-2 py-1 text-[10px] text-white"><ImageIcon className="size-3" />视觉处理中</span> : null}
      </div>
    )
  }
  return <ArticleVisualBlock visual={article.visual} compact={compact} />
}

export function InsightsContent({ initialFeed, username, date }: Props) {
  const [feed, setFeed] = useState(initialFeed)
  const [selected, setSelected] = useState<ArticleView | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async (announce = true) => {
    try {
      const response = await fetch(`/api/agent/articles?date=${date}`, { cache: "no-store" })
      const payload = await response.json() as { data?: DailyArticleFeed | null; error?: string | null }
      if (!response.ok) throw new Error(payload.error || "读取文章失败")
      setFeed(payload.data ?? null)
      setSelected((current) => current && payload.data ? payload.data.articles.find((item) => item.articleId === current.articleId) ?? null : current)
      if (announce) setNotice("阅读流已刷新")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "读取文章失败")
    }
  }, [date])

  const generationStatus = feed?.status ?? "missing"
  const generationBusy = generationStatus === "pending" || generationStatus === "generating"

  useEffect(() => {
    if (!generationBusy) return
    const timer = window.setInterval(() => { void refresh(false) }, 5_000)
    return () => window.clearInterval(timer)
  }, [generationBusy, refresh])

  async function generate() {
    setBusy(true)
    setNotice(null)
    try {
      const response = await fetch("/api/agent/articles", { method: "POST" })
      const payload = await response.json() as { data?: DailyArticleFeed | null; error?: string | null }
      if (!response.ok) throw new Error(payload.error || "提交每日文章后台任务失败")
      setFeed(payload.data ?? null)
      setNotice("已提交后台整理，文章准备好后会自动出现在这里")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "提交每日文章后台任务失败")
    } finally {
      setBusy(false)
    }
  }

  async function updateState(article: ArticleView, input: { read?: boolean; saved?: boolean; hidden?: boolean }) {
    const response = await fetch(`/api/agent/articles/${article.articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const payload = await response.json() as { data?: ArticleView; error?: string | null }
    if (!response.ok || !payload.data) throw new Error(payload.error || "更新阅读状态失败")
    setFeed((current) => {
      if (!current) return current
      const nextArticles = current.articles.map((item) => item.articleId === article.articleId ? payload.data! : item).filter((item) => !item.hiddenAt)
      return { ...current, articles: nextArticles, unreadCount: nextArticles.filter((item) => !item.readAt).length }
    })
    setSelected(input.hidden ? null : payload.data)
  }

  async function openArticle(article: ArticleView) {
    setSelected(article)
    if (!article.readAt) {
      try { await updateState(article, { read: true }) } catch { setNotice("已打开文章，但未能同步已读状态") }
    }
  }

  if (selected) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <button type="button" onClick={() => setSelected(null)} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand-mint-deep)]"><ArrowLeft className="size-4" />返回每日阅读</button>
        <article className="surface-card overflow-hidden">
          <ArticleCover article={selected} />
          <div className="space-y-6 p-5 sm:p-8">
            <div>
              <p className="page-eyebrow">{selected.topic} · 第 {selected.slot} 篇</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--brand-heading)]">{selected.title}</h1>
              <p className="mt-3 text-base leading-7 text-muted-foreground">{selected.summary}</p>
            </div>
            <div className="space-y-5 text-sm leading-7 text-foreground/80">
              <p>{selected.content.intro}</p>
              {selected.content.sections.map((section) => <section key={section.heading}><h2 className="mb-2 text-lg font-semibold text-[var(--brand-heading)]">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mb-2">{paragraph}</p>)}</section>)}
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_.9fr]">
              <div className="rounded-md bg-[var(--brand-mint)]/10 p-4"><p className="text-xs font-semibold text-[var(--brand-mint-deep)]">带走两件事</p><ul className="mt-2 space-y-2 text-sm leading-6">{selected.content.takeaways.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 size-4 shrink-0 text-[var(--brand-mint-deep)]" />{item}</li>)}</ul></div>
              <div className="rounded-md bg-[var(--brand-coral)]/10 p-4"><p className="text-xs font-semibold text-[var(--brand-coral-ink)]">今天可以试试</p><p className="mt-2 text-sm leading-6">{selected.content.action}</p></div>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{selected.content.safetyNote}</p>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/80 pt-4">
              <button type="button" onClick={() => void updateState(selected, { saved: !selected.savedAt }).catch((error) => setNotice(error instanceof Error ? error.message : "更新阅读状态失败"))} className={cn("inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold", selected.savedAt ? "border-[var(--brand-mint-deep)] bg-[var(--brand-mint)]/10 text-[var(--brand-mint-deep)]" : "border-border text-foreground")}><Bookmark className="size-4" />{selected.savedAt ? "已收藏" : "收藏"}</button>
              <button type="button" onClick={() => void updateState(selected, { hidden: true }).catch((error) => setNotice(error instanceof Error ? error.message : "更新阅读状态失败"))} className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground"><EyeOff className="size-4" />稍后再看</button>
            </div>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="grid gap-5 overflow-hidden rounded-lg bg-[var(--brand-plum)] p-6 text-white sm:p-8 lg:grid-cols-[1.2fr_.8fr] lg:p-10">
        <div className="flex flex-col justify-between gap-8">
          <div><p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--brand-mint)]"><Sparkles className="size-3.5" />Personal reading</p><h1 className="max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">{username}，今天有 10 篇为你准备的文章。</h1><p className="mt-4 max-w-xl text-sm leading-6 text-white/65">从你已经留下的饮食、活动和计划出发，给你一点可以马上用上的新视角。</p></div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/65"><span>{formatDate(date)}</span><span className="size-1 rounded-full bg-white/35" /><span>{feed?.unreadCount ?? 0} 篇未读</span></div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/8 p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs text-white/55">今日内容</p><p className="mt-2 text-4xl font-semibold text-[var(--brand-mint)]">{feed?.readyCount ?? 0}<span className="ml-1 text-base text-white/60">/ 10</span></p></div><ImageIcon className="size-5 text-[var(--brand-mint)]" /></div><p className="mt-4 text-xs leading-5 text-white/60">{feed?.imagePendingCount ? `${feed.imagePendingCount} 张配图正在生成，文章可以先读。` : "每篇文章都带有配图或结构化视觉。"}</p></div>
      </section>

      {notice ? <div role="status" className="rounded-md border border-[var(--brand-mint-deep)]/30 bg-[var(--brand-mint)]/10 px-4 py-3 text-sm text-[var(--brand-mint-deep)]">{notice}</div> : null}
      {!feed || feed.readyCount < 10 ? (
        <section className="surface-card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold text-[var(--brand-heading)]">{generationBusy ? "今天的阅读正在后台整理" : generationStatus === "failed" ? "今天的阅读需要重试" : "今天的阅读还没准备好"}</h2><p className="mt-1 text-sm text-muted-foreground">{generationBusy ? "文章会根据你的记录在后台准备好，完成后会自动刷新。" : generationStatus === "failed" ? "后台任务暂时没有完成，可以重新提交一次。" : "把任务交给后台，稍后回来就能看到为你整理的文章。"}</p></div><button type="button" onClick={() => void generate()} disabled={busy || generationBusy} className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand-plum)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy || generationBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{busy ? "正在提交" : generationBusy ? "后台整理中" : generationStatus === "failed" ? "重新提交后台生成" : "交给后台生成"}</button></section>
      ) : null}

      {feed && feed.articles.length > 0 ? <section className="grid gap-5 md:grid-cols-2">{feed.articles.map((article) => <article key={article.articleId} className="surface-card overflow-hidden"><button type="button" onClick={() => void openArticle(article)} className="block w-full text-left"><ArticleCover article={article} compact /><div className="space-y-2 p-5"><div className="flex items-center justify-between gap-3"><p className="page-eyebrow">{String(article.slot).padStart(2, "0")} · {article.topic}</p>{article.savedAt ? <Bookmark className="size-4 fill-[var(--brand-mint-deep)] text-[var(--brand-mint-deep)]" /> : null}</div><h2 className="text-xl font-semibold leading-tight text-[var(--brand-heading)]">{article.title}</h2><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{article.summary}</p></div></button></article>)}</section> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><Link href="/agent" className="font-semibold text-[var(--brand-mint-deep)]">想调整计划？去找 AI 教练</Link><button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground"><RefreshCcw className="size-3.5" />刷新阅读流</button></div>
    </div>
  )
}
