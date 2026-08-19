import { ExternalLink } from "lucide-react"

interface CredentialGuideProps {
  title: string
  description: string
  steps: readonly string[]
  href?: string
  linkLabel?: string
  note?: string
}

export function CredentialGuide({ title, description, steps, href, linkLabel = "打开官方入口", note }: CredentialGuideProps) {
  return (
    <section className="mt-5 rounded-md border border-[var(--brand-mint-deep)]/20 bg-[var(--brand-mint-soft)]/55 p-4 sm:p-5" aria-label={title}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-mint-deep)]">Credential guide</p>
          <h3 className="mt-1 text-base font-semibold text-[var(--brand-heading)]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--brand-heading)]/70">{description}</p>
        </div>
        {href ? (
          <a
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--brand-mint-deep)] underline-offset-4 hover:underline"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {linkLabel}
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      <ol className="mt-4 grid gap-2 text-xs leading-5 text-[var(--brand-heading)]/80">
        {steps.map((step, index) => (
          <li key={`${index}-${step}`} className="flex gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--brand-mint-deep)] text-[10px] font-bold text-white" aria-hidden="true">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {note ? <p className="mt-4 border-t border-[var(--brand-mint-deep)]/15 pt-3 text-[11px] leading-5 text-[var(--brand-heading)]/65">{note}</p> : null}
    </section>
  )
}
