import assert from "node:assert/strict"
import test from "node:test"
import {
  ActionPolicyError,
  assertActionConfirmation,
  consumeActionConfirmation,
  issueActionConfirmation,
} from "../src/lib/actions/policy"
import { createTakeoutOrderDraft } from "../src/lib/mcp/draft"
import {
  MCDONALD_TOOL_DEFINITIONS,
  MCP_TOOL_DEFINITIONS,
  parseNearbyTakeoutSearchInput,
  parseTakeoutOrderDraftInput,
} from "../src/lib/mcp/contracts"
import {
  applyMcDonaldSettingsUpdate,
  createDefaultMcDonaldSettings,
  maskMcDonaldToken,
  normalizeMcDonaldEndpoint,
  parseMcDonaldSettingsUpdate,
} from "../src/lib/mcp/settings-contract"

test("MCP input is bounded and normalized", () => {
  assert.deepEqual(parseNearbyTakeoutSearchInput({ location: "  徐汇区  ", query: "轻食", latitude: 31.2, longitude: 121.4 }), {
    location: "徐汇区",
    query: "轻食",
    latitude: 31.2,
    longitude: 121.4,
    radiusMeters: 3_000,
  })
  assert.throws(() => parseNearbyTakeoutSearchInput({ location: "" }), /搜索位置/)
  assert.deepEqual(parseTakeoutOrderDraftInput({
    restaurantId: "r-1",
    restaurantName: "本地餐厅",
    deliveryAddress: "徐汇区某路 1 号",
    items: [{ name: "鸡胸沙拉", unitPriceCents: 3200 }],
  }).items[0], { name: "鸡胸沙拉", quantity: 1, unitPriceCents: 3200 })
})

test("order draft never submits and binds confirmation to final parameters", () => {
  const draft = createTakeoutOrderDraft(parseTakeoutOrderDraftInput({
    restaurantId: "r-1",
    restaurantName: "本地餐厅",
    deliveryAddress: "徐汇区某路 1 号",
    items: [{ name: "鸡胸沙拉", unitPriceCents: 3200 }],
  }))
  assert.equal(draft.actionClass, "external_write")
  assert.equal(draft.totalCents, 3200)
  assert.doesNotThrow(() => assertActionConfirmation(draft.confirmation.token, "takeout_order_submit", {
    restaurantId: draft.restaurantId,
    restaurantName: draft.restaurantName,
    deliveryAddress: draft.deliveryAddress,
    items: draft.items,
    note: draft.note,
    currency: draft.currency,
    totalCents: draft.totalCents,
  }))
  assert.throws(() => assertActionConfirmation(draft.confirmation.token, "takeout_order_submit", {
    restaurantId: draft.restaurantId,
    restaurantName: draft.restaurantName,
    deliveryAddress: "另一个地址",
    items: draft.items,
    note: draft.note,
    currency: draft.currency,
    totalCents: draft.totalCents,
  }), ActionPolicyError)
  consumeActionConfirmation(draft.confirmation.token, "takeout_order_submit", {
    restaurantId: draft.restaurantId,
    restaurantName: draft.restaurantName,
    deliveryAddress: draft.deliveryAddress,
    items: draft.items,
    note: draft.note,
    currency: draft.currency,
    totalCents: draft.totalCents,
  })
  assert.throws(() => assertActionConfirmation(draft.confirmation.token, "takeout_order_submit", {}), ActionPolicyError)
})

test("order confirmation tokens are bound to the issuing account", () => {
  const draft = createTakeoutOrderDraft(parseTakeoutOrderDraftInput({
    restaurantId: "r-scoped",
    restaurantName: "Account scoped restaurant",
    deliveryAddress: "Private address",
    items: [{ name: "Meal", unitPriceCents: 1200 }],
  }), 101)
  const submission = {
    restaurantId: draft.restaurantId,
    restaurantName: draft.restaurantName,
    deliveryAddress: draft.deliveryAddress,
    items: draft.items,
    note: draft.note,
    currency: draft.currency,
    totalCents: draft.totalCents,
  }
  assert.doesNotThrow(() => assertActionConfirmation(draft.confirmation.token, "takeout_order_submit", submission, Date.now(), 101))
  assert.throws(() => assertActionConfirmation(draft.confirmation.token, "takeout_order_submit", submission, Date.now(), 202), ActionPolicyError)
})

test("tool registry exposes connector state without credentials", () => {
  const tools = MCP_TOOL_DEFINITIONS
  assert.equal(tools.some((tool) => tool.name === "nearby_takeout_search"), true)
  assert.equal(tools.some((tool) => "apiKey" in tool), false)
})

test("McDonald tool registry exposes the official order chain without credentials", () => {
  const toolNames = MCDONALD_TOOL_DEFINITIONS.map((tool) => tool.name)
  for (const required of ["delivery-query-addresses", "delivery-query-stores", "query-meals", "calculate-price", "create-order", "query-order"]) {
    assert.equal(toolNames.includes(required as never), true)
  }
  assert.equal(MCDONALD_TOOL_DEFINITIONS.find((tool) => tool.name === "create-order")?.actionClass, "external_write")
  assert.equal(MCDONALD_TOOL_DEFINITIONS.some((tool) => "token" in tool), false)
})

test("blank McDonald token preserves the local credential and explicit clear removes it", () => {
  const initial = applyMcDonaldSettingsUpdate(
    createDefaultMcDonaldSettings(),
    parseMcDonaldSettingsUpdate({ token: "mcd-local-token-1234" }),
    "2026-08-16T00:00:00.000Z"
  )
  const preserved = applyMcDonaldSettingsUpdate(
    initial,
    parseMcDonaldSettingsUpdate({ token: "" }),
    "2026-08-16T00:01:00.000Z"
  )
  const cleared = applyMcDonaldSettingsUpdate(
    preserved,
    parseMcDonaldSettingsUpdate({ clearToken: true }),
    "2026-08-16T00:02:00.000Z"
  )

  assert.equal(preserved.token, "mcd-local-token-1234")
  assert.equal(cleared.token, null)
  assert.equal(maskMcDonaldToken("mcd-local-token-1234"), "••••1234")
})

test("McDonald settings reject unsafe endpoints and multiline tokens", () => {
  assert.equal(normalizeMcDonaldEndpoint("https://mcp.mcd.cn/"), "https://mcp.mcd.cn")
  assert.throws(() => normalizeMcDonaldEndpoint("http://mcp.example.com"), /HTTPS/)
  assert.throws(() => parseMcDonaldSettingsUpdate({ token: "secret\nleak" }), /格式无效/)
})

test("read actions cannot manufacture an external confirmation token", () => {
  assert.throws(() => issueActionConfirmation("nearby_takeout_search", { location: "徐汇区" }), ActionPolicyError)
})
