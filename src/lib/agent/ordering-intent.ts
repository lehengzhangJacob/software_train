// ADR-0004 gate: only an explicit McDonald's ordering request in the current
// message can authorize the autonomous ordering flow. Conservative by design:
// a false negative costs the user a rephrase, a false positive creates an
// order nobody asked for. Both signals are required, and hard blocks win.

const MCDONALD_SIGNAL = /麦当劳|巨无霸|麦乐送|麦辣|板烧|麦旋风|麦香鱼|麦香鸡|吉士汉堡|mcdonald/i

const ORDERING_DIRECTIVE =
  /帮我点|帮我订|帮我买|帮我叫|给我点|给我订|给我买|给我来|给我叫|我要点|我要订|我要买|我想点|我想订|来一份|来一个|来个|来几|点一份|点一个|点个|点几|订一份|订一个|订个|买一份|买个/

const HARD_BLOCK = /不点|不用点|别点|不想点|不要点|先不点|先别点|点过了|订过了|已经点|已经订|取消/

export function hasExplicitOrderingIntent(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (HARD_BLOCK.test(text)) return false
  return MCDONALD_SIGNAL.test(text) && ORDERING_DIRECTIVE.test(text)
}
