import "server-only"

import { runDailyArticleJob } from "@/lib/agent/content/generator"

const activeJobs = new Map<string, Promise<void>>()

export function scheduleDailyArticleJob(contentDate: string) {
  if (activeJobs.has(contentDate)) return
  const job = Promise.resolve()
    .then(() => runDailyArticleJob(contentDate))
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => activeJobs.delete(contentDate))
  activeJobs.set(contentDate, job)
}
