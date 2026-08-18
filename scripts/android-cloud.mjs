// Bake the deployed cloud URL into the Android shell (form B, ADR-0007).
// Usage: node scripts/android-cloud.mjs [url]
// Defaults to the current cloud instance; a plain `npx cap sync android`
// restores the loopback dev URL (form A).

import { spawnSync } from "node:child_process"

const url = process.argv[2] || process.env.FT_CLOUD_URL || "http://8.148.206.131:8000"

console.log(`[android:cloud] syncing shell against ${url}`)
const result = spawnSync("npx", ["cap", "sync", "android"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, FT_CLOUD_URL: url },
})
process.exit(result.status ?? 1)
