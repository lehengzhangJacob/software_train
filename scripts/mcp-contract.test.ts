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
  MCP_TOOL_DEFINITIONS,
  parseNearbyTakeoutSearchInput,
  parseTakeoutOrderDraftInput,
} from "../src/lib/mcp/contracts"

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

test("tool registry exposes connector state without credentials", () => {
  const tools = MCP_TOOL_DEFINITIONS
  assert.equal(tools.some((tool) => tool.name === "nearby_takeout_search"), true)
  assert.equal(tools.some((tool) => "apiKey" in tool), false)
})

test("read actions cannot manufacture an external confirmation token", () => {
  assert.throws(() => issueActionConfirmation("nearby_takeout_search", { location: "徐汇区" }), ActionPolicyError)
})
