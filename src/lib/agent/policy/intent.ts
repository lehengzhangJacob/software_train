export const AGENT_INTENTS = [
  "nutrition",
  "fitness",
  "recovery",
  "health-data",
  "food-ordering",
  "current-research",
  "ambiguous",
  "off-topic",
] as const

export type AgentIntent = (typeof AGENT_INTENTS)[number]

export type AgentIntentDecision = {
  intent: AgentIntent
  inScope: boolean
  requiresWebSearch: boolean
  safeSummary: string
  safeReply?: string
}

const OFF_TOPIC_REPLY = "我是你的饮食与运动教练，目前专注于饮食、训练、恢复和健康记录。这个话题和你的目标没有直接关系；如果你想把它转成训练激励或饮食计划，我可以继续。"

const nutritionSignals = [
  "吃", "餐", "饮食", "食物", "热量", "卡路里", "蛋白", "碳水", "脂肪", "营养", "减脂", "增肌",
  "早餐", "午餐", "晚餐", "加餐", "零食", "饥饿", "份量", "食谱", "菜单", "外卖", "麦当劳",
]
const fitnessSignals = [
  "运动", "锻炼", "训练", "健身", "跑步", "步数", "俯卧撑", "深蹲", "引体", "力量", "有氧", "心率",
  "动作", "训练量", "肌肉", "器械", "体能", "拉伸", "热身", "柔韧", "瑜伽", "骑行", "游泳",
]
const recoverySignals = ["恢复", "睡眠", "疲劳", "酸痛", "休息", "放松", "疼痛", "受伤", "康复", "压力"]
const healthDataSignals = ["健康记录", "健康数据", "health connect", "活动消耗", "运动分钟", "步数趋势"]
const currentResearchSignals = ["最新", "今年", "研究", "指南", "证据", "文献", "资料", "搜索", "联网", "查一下", "官方"]
const orderingSignals = ["帮我点", "替我点", "帮我订", "替我订", "下单", "点餐", "点外卖", "订外卖", "购买"]
const offTopicSignals = [
  "战锤", "warhammer", "40k", "编程", "代码", "python", "javascript", "股票", "基金", "选举", "政治",
  "旅游", "机票", "酒店", "歌词", "动漫", "游戏", "电影", "小说", "明星", "音乐", "足球比赛",
]
const coachingBridgeSignals = ["训练", "健身", "运动", "饮食", "营养", "恢复", "睡眠", "减脂", "增肌"]

function normalizeMessage(message: string) {
  return message.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ").trim()
}

function includesAny(message: string, signals: readonly string[]) {
  return signals.some((signal) => message.includes(signal))
}

export function classifyAgentIntent(message: string): AgentIntentDecision {
  const normalized = normalizeMessage(message)
  const hasNutrition = includesAny(normalized, nutritionSignals)
  const hasFitness = includesAny(normalized, fitnessSignals)
  const hasRecovery = includesAny(normalized, recoverySignals)
  const hasHealthData = includesAny(normalized, healthDataSignals)
  const hasOrdering = includesAny(normalized, orderingSignals)
  const hasCurrentResearch = includesAny(normalized, currentResearchSignals)
  const hasOffTopic = includesAny(normalized, offTopicSignals)
  const hasCoachingBridge = includesAny(normalized, coachingBridgeSignals)
  const hasDomainSignal = hasNutrition || hasFitness || hasRecovery || hasHealthData || hasOrdering

  if (hasOffTopic && !hasCoachingBridge) {
    return {
      intent: "off-topic",
      inScope: false,
      requiresWebSearch: false,
      safeSummary: "话题超出饮食与运动教练范围",
      safeReply: OFF_TOPIC_REPLY,
    }
  }

  if (hasOrdering) {
    return {
      intent: "food-ordering",
      inScope: true,
      requiresWebSearch: false,
      safeSummary: "已识别为当前消息的点餐请求",
    }
  }

  if (hasCurrentResearch && hasDomainSignal) {
    return {
      intent: "current-research",
      inScope: true,
      requiresWebSearch: true,
      safeSummary: "已识别需要公开资料检索",
    }
  }

  if (hasFitness) {
    return { intent: "fitness", inScope: true, requiresWebSearch: false, safeSummary: "已确认属于运动与训练咨询" }
  }
  if (hasRecovery) {
    return { intent: "recovery", inScope: true, requiresWebSearch: false, safeSummary: "已确认属于恢复与习惯咨询" }
  }
  if (hasHealthData) {
    return { intent: "health-data", inScope: true, requiresWebSearch: false, safeSummary: "已确认属于健康活动记录咨询" }
  }
  if (hasNutrition) {
    return { intent: "nutrition", inScope: true, requiresWebSearch: false, safeSummary: "已确认属于饮食与营养咨询" }
  }
  if (hasOffTopic) {
    return {
      intent: "off-topic",
      inScope: false,
      requiresWebSearch: false,
      safeSummary: "话题超出饮食与运动教练范围",
      safeReply: OFF_TOPIC_REPLY,
    }
  }

  return { intent: "ambiguous", inScope: true, requiresWebSearch: false, safeSummary: "暂未确认具体领域，将由教练继续澄清" }
}

export const AGENT_OFF_TOPIC_REPLY = OFF_TOPIC_REPLY
