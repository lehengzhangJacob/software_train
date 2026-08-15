import { apiError, apiSuccess } from "@/lib/api-response"
import { listMcpTools } from "@/lib/mcp/gateway"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return apiSuccess({ tools: listMcpTools() })
  } catch {
    return apiError("读取 MCP 工具状态失败", 500)
  }
}
