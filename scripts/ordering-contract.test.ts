import assert from "node:assert/strict"
import test from "node:test"

import type { McDonaldMcpSession } from "../src/lib/mcp/mcdonalds-client"
import { McpUnavailableError } from "../src/lib/mcp/contracts"
import { issueOrderingGrant } from "../src/lib/actions/policy"
import { parseAgentMessageMetadata } from "../src/lib/agent/contracts"
import { createAgentActivityRecorder } from "../src/lib/agent/activity"
import {
  composeOrderedReply,
  composeOrderingReply,
  executeMcDonaldOrder,
  extractOrderSelection,
  itemsTotalCentsOf,
  planMcDonaldOrder,
  type MenuOption,
  type OrderingDeps,
} from "../src/lib/agent/ordering"

const ADDRESS_RESULT = {
  addresses: [{ addressId: "addr-1", address: "朝阳区望京街 1 号", isDefault: true }],
}
const STORE_RESULT = {
  stores: [{ storeId: "store-7", storeName: "望京店" }],
}
const MENU_RESULT = {
  meals: [
    { code: "big-mac", name: "巨无霸", price: 25.5 },
    { code: "mc-chicken", name: "麦香鸡", price: 13 },
    { code: "corn-cup", name: "玉米杯", price: 8 },
  ],
}

function fakeSession(overrides: Partial<Record<string, unknown>> = {}) {
  const calls: Array<{ name: string; input: unknown }> = []
  const session: McDonaldMcpSession = {
    async listTools() {
      return []
    },
    async callTool(name, input = {}) {
      calls.push({ name, input })
      if (name in overrides) return overrides[name]
      if (name === "delivery-query-addresses") return ADDRESS_RESULT
      if (name === "delivery-query-stores") return STORE_RESULT
      if (name === "query-meals") return MENU_RESULT
      if (name === "calculate-price") return { payableTotal: 46.5, deliveryFee: 9 }
      throw new Error(`unexpected tool ${name}`)
    },
  }
  return { session, calls }
}

function depsWith(
  overrides: Partial<Record<string, unknown>> = {},
  selectItems?: OrderingDeps["selectItems"],
  verifyPrice?: OrderingDeps["verifyPrice"],
): OrderingDeps & { calls: Array<{ name: string; input: unknown }> } {
  const { session, calls } = fakeSession(overrides)
  return {
    openSession: (run) => run(session),
    selectItems:
      selectItems ??
      (async ({ menu }) => ({
        items: [
          { code: menu[0].code, quantity: 1 },
          { code: menu[1].code, quantity: 2 },
        ],
        note: "蛋白质优先，热量在预算内",
      })),
    ...(verifyPrice ? { verifyPrice } : {}),
    calls,
  }
}

test("ordering pipeline plans a meal from address to pricing", async () => {
  const deps = depsWith()
  const outcome = await planMcDonaldOrder(deps, "帮我点份麦当劳", 600)
  assert.equal(outcome.status, "planned")
  if (outcome.status !== "planned") return
  assert.equal(outcome.plan.addressLabel, "朝阳区望京街 1 号")
  assert.equal(outcome.plan.storeName, "望京店")
  assert.deepEqual(
    outcome.plan.items.map((item) => `${item.code}:${item.quantity}`),
    ["big-mac:1", "mc-chicken:2"],
  )
  assert.deepEqual(
    deps.calls.map((call) => call.name),
    ["delivery-query-addresses", "delivery-query-stores", "query-meals", "calculate-price"],
  )
})

test("ordering pipeline emits a safe multi-step activity trace", async () => {
  const recorder = createAgentActivityRecorder()
  const deps = depsWith()
  deps.reportActivity = recorder.emit

  const outcome = await planMcDonaldOrder(deps, "order mcdonald", 600)

  assert.equal(outcome.status, "planned")
  assert.deepEqual(
    recorder.snapshot().map((step) => step.activityId),
    ["mcdonald-addresses", "mcdonald-stores", "mcdonald-menu", "mcdonald-selection", "mcdonald-price"],
  )
  assert.ok(recorder.snapshot().every((step) => step.status === "completed"))
  assert.ok(recorder.snapshot().every((step) => !step.detail?.includes("Bearer")))
})

test("missing mcdonald token surfaces as an explicit blocked reason", async () => {
  const deps: OrderingDeps = {
    openSession: async () => {
      throw new McpUnavailableError("请先在 AI 服务页面配置麦当劳 MCP Token")
    },
    selectItems: async () => ({ items: [], note: "" }),
  }
  const outcome = await planMcDonaldOrder(deps, "帮我点份麦当劳", 600)
  assert.deepEqual(outcome, { status: "blocked", reason: "请先在 AI 服务页面配置麦当劳 MCP Token" })
})

test("empty addresses, stores or menu each block with a concrete reason", async () => {
  const noAddress = await planMcDonaldOrder(depsWith({ "delivery-query-addresses": { addresses: [] } }), "帮我点份麦当劳", 600)
  assert.deepEqual(noAddress, { status: "blocked", reason: "麦当劳账号中没有可用的配送地址" })

  const noStore = await planMcDonaldOrder(depsWith({ "delivery-query-stores": { stores: [] } }), "帮我点份麦当劳", 600)
  assert.deepEqual(noStore, { status: "blocked", reason: "当前地址没有可配送的麦当劳门店" })

  const noMenu = await planMcDonaldOrder(depsWith({ "query-meals": { meals: [] } }), "帮我点份麦当劳", 600)
  assert.deepEqual(noMenu, { status: "blocked", reason: "门店菜单暂时不可用" })

  const noPrice = await planMcDonaldOrder(depsWith({ "calculate-price": null }), "帮我点份麦当劳", 600)
  assert.deepEqual(noPrice, { status: "blocked", reason: "订单计价失败，暂不能继续下单" })
})

test("selection outside the menu or beyond quantity bounds blocks instead of ordering", async () => {
  const outsider = await planMcDonaldOrder(
    depsWith({}, async () => ({ items: [{ code: "whopper", quantity: 1 }], note: "" })),
    "帮我点份麦当劳",
    600,
  )
  assert.deepEqual(outsider, { status: "blocked", reason: "选餐结果包含菜单外的商品，已停止下单" })

  const tooMany = await planMcDonaldOrder(
    depsWith({}, async ({ menu }) => ({
      items: [...menu, ...menu, ...menu].map((option) => ({ code: option.code, quantity: 1 })),
      note: "",
    })),
    "帮我点份麦当劳",
    600,
  )
  assert.deepEqual(tooMany, { status: "blocked", reason: "选餐数量必须在 1 到 8 项之间" })

  const overQuantity = await planMcDonaldOrder(
    depsWith({}, async () => ({ items: [{ code: "big-mac", quantity: 10 }], note: "" })),
    "帮我点份麦当劳",
    600,
  )
  assert.deepEqual(overQuantity, { status: "blocked", reason: "单个商品数量必须在 1 到 9 之间" })
})

test("price verification mismatch blocks order creation", async () => {
  const outcome = await planMcDonaldOrder(
    depsWith({}, undefined, () => false),
    "帮我点份麦当劳",
    600,
  )
  assert.deepEqual(outcome, { status: "blocked", reason: "计价结果与选餐合计不一致，已停止下单" })
})

test("model selection payload must be a tagged or bare json object with items", () => {
  const parsed = extractOrderSelection('<order-selection>{"items":[{"code":"big-mac","quantity":2}],"note":"高蛋白"}</order-selection>')
  assert.deepEqual(parsed.items, [{ code: "big-mac", quantity: 2 }])
  assert.equal(parsed.note, "高蛋白")

  assert.throws(() => extractOrderSelection("<order-selection>{not json}</order-selection>"), /有效的选餐结果/)
  assert.throws(() => extractOrderSelection('{"note":"没有商品"}'), /缺少商品列表/)
})

test("menu math sums only when every selected item carries a price", () => {
  const menu: MenuOption[] = [
    { code: "a", name: "A", priceCents: 1000 },
    { code: "b", name: "B", priceCents: null },
  ]
  assert.equal(
    itemsTotalCentsOf(
      [
        { code: "a", name: "A", quantity: 2 },
        { code: "a", name: "A", quantity: 1 },
      ],
      menu,
    ),
    3000,
  )
  assert.equal(itemsTotalCentsOf([{ code: "b", name: "B", quantity: 1 }], menu), null)
})

test("composed ordering replies stay free of links and credentials", async () => {
  const planned = await planMcDonaldOrder(depsWith(), "帮我点份麦当劳", 600)
  const texts = [
    composeOrderingReply(planned),
    composeOrderingReply({ status: "blocked", reason: "麦当劳账号中没有可用的配送地址" }),
  ]
  for (const text of texts) {
    assert.match(text, /麦当劳|下单/)
    assert.doesNotMatch(text, /https?:\/\/|bearer|token|api[_ -]?key/i)
  }
})

test("create-order runs once per grant and the payment link never reaches persisted text", async () => {
  const deps = depsWith({
    "create-order": { orderId: "order-88", payUrl: "https://pay.example/o88", payableTotal: 46.5 },
  })
  const planned = await planMcDonaldOrder(deps, "帮我点份麦当劳", 600)
  assert.equal(planned.status, "planned")
  if (planned.status !== "planned") return

  const grant = issueOrderingGrant(true)
  const execution = await executeMcDonaldOrder(deps.openSession, grant, planned.plan)
  assert.equal(execution.status, "created")
  if (execution.status !== "created") return
  assert.equal(execution.order.orderId, "order-88")
  assert.equal(execution.order.paymentLink, "https://pay.example/o88")
  assert.deepEqual(deps.calls.at(-1)?.input, {
    addressId: "addr-1",
    storeId: "store-7",
    items: [
      { code: "big-mac", quantity: 1 },
      { code: "mc-chicken", quantity: 2 },
    ],
  })
  assert.throws(() => grant.claimCreateOrder(), /最多创建一笔/)

  const reply = composeOrderedReply(planned.plan, execution)
  assert.match(reply, /order-88/)
  assert.match(reply, /不会代你支付/)
  assert.doesNotMatch(reply, /pay\.example|https?:\/\//i)
})

test("create-order without a usable id or link blocks honestly", async () => {
  const planned = await planMcDonaldOrder(depsWith(), "帮我点份麦当劳", 600)
  if (planned.status !== "planned") throw new Error("plan failed")

  const noOrder = await executeMcDonaldOrder(
    depsWith({ "create-order": { payableTotal: 46.5 } }).openSession,
    issueOrderingGrant(true),
    planned.plan,
  )
  assert.deepEqual(noOrder, { status: "blocked", reason: "麦当劳没有确认订单创建，本次未下单" })

  const linkShapedId = await executeMcDonaldOrder(
    depsWith({ "create-order": { orderId: "https://evil.example/order" } }).openSession,
    issueOrderingGrant(true),
    planned.plan,
  )
  assert.deepEqual(linkShapedId, { status: "blocked", reason: "麦当劳没有确认订单创建，本次未下单" })

  const blockedReply = composeOrderedReply(planned.plan, noOrder)
  assert.match(blockedReply, /没能创建订单/)
  assert.doesNotMatch(blockedReply, /https?:\/\//i)
})

test("order digest metadata survives a whitelisted round-trip without links", () => {
  const parsed = parseAgentMessageMetadata(
    JSON.stringify({
      order: { orderId: "order-88", itemsTotalCents: 5150, itemCount: 2, storeName: "望京店" },
      paymentLink: "https://pay.example/o88",
      apiKey: "must-not-survive",
    }),
  )
  assert.deepEqual(parsed.order, { orderId: "order-88", itemsTotalCents: 5150, itemCount: 2, storeName: "望京店" })
  assert.equal("paymentLink" in parsed, false)
  assert.equal("apiKey" in parsed, false)

  const urlShaped = parseAgentMessageMetadata(
    JSON.stringify({ order: { orderId: "https://evil.example", itemCount: 1, storeName: "望京店" } }),
  )
  assert.equal(urlShaped.order?.orderId, null)

  assert.deepEqual(parseAgentMessageMetadata(JSON.stringify({ order: "junk" })).order, undefined)
})
