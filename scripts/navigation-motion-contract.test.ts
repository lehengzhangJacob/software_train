import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const sidebar = readFileSync("src/components/sidebar.tsx", "utf8")
const chrome = readFileSync("src/components/app-chrome.tsx", "utf8")
const todayTabs = readFileSync("src/components/today-tabs.tsx", "utf8")
const planTabs = readFileSync("src/components/plan-tabs.tsx", "utf8")
const styles = readFileSync("src/app/globals.css", "utf8")

test("mobile navigation reserves a centered meal action without dropping routes", () => {
  assert.match(sidebar, /mobileNav\.slice\(0, 2\)/)
  assert.match(sidebar, /mobileNav\[2\]/)
  assert.match(sidebar, /mobileNav\.slice\(3\)/)
  assert.match(sidebar, /w-16 shrink-0/)
  assert.match(sidebar, /aria-label="移动端主导航"/)
  assert.match(sidebar, /mobile-nav-indicator-active/)
  assert.doesNotMatch(sidebar, /label: "阅读"/)
  assert.match(sidebar, /matches: \["\/dashboard", "\/insights"\]/)
})

test("reading stays inside the today secondary navigation", () => {
  assert.match(chrome, /<TodayTabs \/>/)
  assert.match(todayTabs, /aria-label="今天二级导航"/)
  assert.match(todayTabs, /href: "\/dashboard"/)
  assert.match(todayTabs, /href: "\/insights"/)
  assert.match(todayTabs, /isTodayArea/)
})

test("route and plan tab changes expose motion hooks with a reduced-motion escape hatch", () => {
  assert.match(chrome, /key=\{pathname\}/)
  assert.match(chrome, /app-route-transition/)
  assert.match(planTabs, /transition-\[background-color,color,box-shadow,transform\]/)
  assert.match(planTabs, /scale-x-100/)
  assert.match(styles, /@keyframes app-route-enter/)
  assert.match(styles, /prefers-reduced-motion: reduce/)
})
