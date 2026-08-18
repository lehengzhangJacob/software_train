// Cloud gate verification (C-11-S2): proves the public instance rejects
// unauthenticated traffic and admits the shared passcode holder.
// Usage: APP_ACCESS_TOKEN=<code> node scripts/verify-cloud-gate.mjs [base-url]

const BASE = process.argv[2] || `http://${process.env.DEPLOY_HOST || "8.148.206.131"}:${process.env.DEPLOY_PORT || "8000"}`
const CODE = process.env.APP_ACCESS_TOKEN

if (!CODE) {
  console.error("APP_ACCESS_TOKEN (the shared access code) is required")
  process.exit(2)
}

let failures = 0

function check(name, ok, detail = "") {
  const status = ok ? "pass" : "FAIL"
  console.log(`${status}: ${name}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures += 1
}

async function main() {
  // 1. unauthenticated API is rejected with 401
  const api = await fetch(`${BASE}/api/users`, { redirect: "manual" })
  check("unauthenticated /api/users -> 401", api.status === 401, `got ${api.status}`)

  // 2. unauthenticated page redirects to /access
  const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" })
  check(
    "unauthenticated /dashboard -> 307 to /access",
    page.status === 307 && (page.headers.get("location") || "").endsWith("/access"),
    `got ${page.status} -> ${page.headers.get("location")}`
  )

  // 3. gate page renders
  const gatePage = await fetch(`${BASE}/access`)
  const gateHtml = await gatePage.text()
  check(
    "/access renders passcode form",
    gatePage.status === 200 && gateHtml.includes("访问验证"),
    `got ${gatePage.status}`
  )

  // 4. wrong code rejected
  const wrong = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: "definitely-wrong-code" }),
  })
  check("wrong code -> 401", wrong.status === 401, `got ${wrong.status}`)

  // 5. correct code sets the digest cookie
  const verify = await fetch(`${BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  })
  const setCookie = verify.headers.get("set-cookie") || ""
  check(
    "correct code -> 200 + ft_access cookie",
    verify.status === 200 && setCookie.startsWith("ft_access=") && !setCookie.includes(CODE),
    `got ${verify.status}`
  )

  // 6. cookie holder reaches the business API
  const cookie = setCookie.split(";")[0]
  const authed = await fetch(`${BASE}/api/users`, { headers: { cookie } })
  check("authed /api/users -> 200", authed.status === 200, `got ${authed.status}`)

  // 7. authed page renders (conversation surface exists)
  const authedPage = await fetch(`${BASE}/agent`, { headers: { cookie }, redirect: "manual" })
  check("authed /agent -> 200", authedPage.status === 200, `got ${authedPage.status}`)

  console.log(failures === 0 ? "cloud gate verification: ALL PASS" : `cloud gate verification: ${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("verify-cloud-gate crashed:", error)
  process.exit(1)
})
