import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const chrome = readFileSync("src/components/app-chrome.tsx", "utf8")
const sidebar = readFileSync("src/components/sidebar.tsx", "utf8")
const agent = readFileSync("src/components/agent/agent-workspace.tsx", "utf8")
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
