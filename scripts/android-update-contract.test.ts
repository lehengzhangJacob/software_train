import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("Android shell release metadata tracks the web release version", () => {
  const gradle = readFileSync("android/app/build.gradle", "utf8")
  assert.match(gradle, /versionCode\s+3/)
  assert.match(gradle, /versionName\s+"0\.1\.2"/)
})
