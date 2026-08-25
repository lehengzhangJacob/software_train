import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const chrome = readFileSync("src/components/app-chrome.tsx", "utf8")
const sidebar = readFileSync("src/components/sidebar.tsx", "utf8")
const agent = readFileSync("src/components/agent/agent-workspace.tsx", "utf8")
const meals = readFileSync("src/components/food/meals-content.tsx", "utf8")
const styles = readFileSync("src/app/globals.css", "utf8")

test("mobile keyboard state keeps focused app controls in the visible viewport", () => {
  assert.match(chrome, /window\.visualViewport/)
  assert.match(chrome, /--keyboard-inset/)
  assert.match(chrome, /root\.dataset\.keyboardOpen = keyboardOpen \? "true" : "false"/)
  assert.match(chrome, /target\.scrollIntoView\(\{ block: "center"/)
  assert.match(sidebar, /data-mobile-nav/)
  assert.match(styles, /html\[data-keyboard-open="true"\] #main-content/)
  assert.match(styles, /html\[data-keyboard-open="true"\] \[data-mobile-nav\]/)
})

test("agent workspace subtracts keyboard inset before sizing its composer panel", () => {
  assert.match(agent, /min-h-\[min\(28rem,calc\(100dvh-9rem-var\(--keyboard-inset,0px\)\)\)\]/)
  assert.match(agent, /data-testid="agent-composer"/)
  assert.match(agent, /className="shrink-0 border-t border-border\/70/)
})

test("profile menu uses the branded, touch-friendly surface", () => {
  assert.match(sidebar, /data-slot="dropdown-menu-label"/)
  assert.match(sidebar, /当前账户/)
  assert.match(sidebar, /w-\[min\(18rem,calc\(100vw-2rem\)\)\]/)
  assert.match(sidebar, /sideOffset=\{10\}/)
  assert.match(sidebar, /min-h-11 gap-3 rounded-md px-3 py-2 text-sm/)
  assert.match(sidebar, /var\(--brand-mint-deep\)/)
})

test("manual meal entry keeps grouped fields large enough for mobile input", () => {
  assert.match(meals, /data-testid="manual-meal-form"/)
  assert.match(meals, /aria-controls="manual-meal-form"/)
  assert.match(meals, /<fieldset className="space-y-3 rounded-lg border border-border\/70/)
  assert.match(meals, /className="h-11 rounded-md border-border\/80 bg-white\/80 px-3"/)
  assert.match(meals, /className="h-11 w-full rounded-md border-border\/80 bg-white\/80 px-3 data-\[size=default\]:h-11"/)
  assert.match(meals, /enterKeyHint="done"/)
})
