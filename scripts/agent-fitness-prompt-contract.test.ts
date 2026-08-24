import assert from "node:assert/strict"
import test from "node:test"
import { buildAgentDomainInstructions } from "../src/lib/agent/prompt-policy"

test("domain instructions make the Agent a nutrition, fitness and recovery coach", () => {
  const prompt = buildAgentDomainInstructions("fitness")
  assert.match(prompt, /饮食、训练、恢复和健康记录/)
  assert.match(prompt, /频率、总量、强度、动作质量和恢复情况/)
  assert.match(prompt, /持续疼痛、胸痛、晕厥、呼吸困难/)
  assert.match(prompt, /当前回合意图是：fitness/)
})

test("prompt never claims web search when capability is not enabled", () => {
  assert.match(buildAgentDomainInstructions("current-research"), /未确认联网搜索能力/)
  assert.match(buildAgentDomainInstructions("current-research", true), /已启用受控公开资料检索/)
})
