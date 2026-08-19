// Cloud account verification (C-17): proves the public instance rejects
// anonymous traffic and admits a database-backed account session.
// Usage:
//   DEMO_LOGIN=... DEMO_PASSWORD=... node scripts/verify-cloud-gate.mjs [base-url]

const BASE = (process.argv[2] || `http://${process.env.DEPLOY_HOST || "8.148.206.131"}:${process.env.DEPLOY_PORT || "8000"}`).replace(/\/+$/, "")
const LOGIN = process.env.DEMO_LOGIN?.trim()
const PASSWORD = process.env.DEMO_PASSWORD || ""

if (!LOGIN || !PASSWORD) {
  console.error("DEMO_LOGIN and DEMO_PASSWORD are required; credentials are never written to evidence")
  process.exit(2)
}

let failures = 0

function check(name, ok, detail = "") {
  const status = ok ? "pass" : "FAIL"
  console.log(`${status}: ${name}${detail ? ` (${detail})` : ""}`)
  if (!ok) failures += 1
}

function sessionCookie(response) {
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") || ""]
  return cookies[0]?.split(";")[0] || ""
}

async function main() {
  const api = await fetch(`${BASE}/api/users`, { redirect: "manual" })
  check("anonymous /api/users -> 401", api.status === 401, `got ${api.status}`)

  const page = await fetch(`${BASE}/dashboard`, { redirect: "manual" })
  check(
    "anonymous /dashboard -> 307 to /access",
    page.status === 307 && (page.headers.get("location") || "").endsWith("/access"),
    `got ${page.status} -> ${page.headers.get("location")}`,
  )

  const gatePage = await fetch(`${BASE}/access`)
  const gateHtml = await gatePage.text()
  check(
    "/access renders login and invite registration",
    gatePage.status === 200 && gateHtml.includes("登录") && gateHtml.includes("邀请码注册"),
    `got ${gatePage.status}`,
  )

  const wrong = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: `${PASSWORD}-wrong` }),
  })
  check("wrong password -> 401", wrong.status === 401, `got ${wrong.status}`)

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
  })
  const cookie = sessionCookie(login)
  check(
    "valid account -> 200 + ft_session cookie",
    login.status === 200 && cookie.startsWith("ft_session=") && !cookie.includes(PASSWORD),
    `got ${login.status}`,
  )

  const authed = await fetch(`${BASE}/api/users`, { headers: { cookie } })
  check("authenticated /api/users -> 200", authed.status === 200, `got ${authed.status}`)

  const authedPage = await fetch(`${BASE}/agent`, { headers: { cookie }, redirect: "manual" })
  check("authenticated /agent -> 200", authedPage.status === 200, `got ${authedPage.status}`)

  const session = await fetch(`${BASE}/api/auth/session`, { headers: { cookie } })
  check("authenticated /api/auth/session -> 200", session.status === 200, `got ${session.status}`)

  console.log(failures === 0 ? "cloud account verification: ALL PASS" : `cloud account verification: ${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("verify-cloud-gate crashed:", error)
  process.exit(1)
})
