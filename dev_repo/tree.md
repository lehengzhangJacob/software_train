# Campaign: nutrition-agent

## Current execution override

- Current contract: `C-13 - Android 拍照闭环与产品图标收口` [completed]
- Current slice: `C-13-S3 - 模拟器拍照识别闭环与最终发布检查` [completed]
- Return path: `web_completion_audit`
- The older C-13 current-line text below is historical and is superseded by the runtime state above.

- 当前合同：`C-13 - Android 拍照闭环与产品图标收口 [completed]`
- 当前切片：`C-13-S3 - 模拟器拍照识别闭环与最终发布检查`
- 下一步：C-13-S3 已完成，返回 `web_completion_audit`
- 已收口子合同（历史桶）：`C-02 发布收口`；`C-03 本地营养 Agent`；`C-04 Keep 风格全界面`；`C-05 聚焦导航与自动记忆`；`C-06 麦当劳点餐闭环`（含 A1/C-07/C-08/C-09/C-10/L4-A1/A2）；`C-11 云端交付与双端收口`（A1 修宪 652e53e / S1 部署通道 230ed10 / S2 访问门 732ec30 / S3 形态 B）[均 completed]

```text
C-01 - 全栈功能初版 [completed]
└── C-02 - 课程项目接手验收与发布收口 [completed]
    └── C-03 - 本地个人营养 Agent [completed]
        └── C-04 - Keep 风格全界面产品化 [completed]
            └── C-05 - 聚焦导航与自动记忆 [completed]
                └── C-06 - 麦当劳本地点餐闭环 [completed]
                    └── C-11 - 云端交付与双端收口 [completed]
                        ├── A1 cloud.delivery 架构修宪（ADR-0007）[completed]
                        ├── S1 部署通道：standalone + systemd + 云端种子 [completed]
                        ├── S2 公网访问门：middleware + 访问码 + 401 [completed]
                        └── S3 Android 形态 B + 双端同源回归 [completed]
                        └── C-12 - 测试数据、核心功能回归与 README 素材 [completed]
                                ├── S1 真实云端演示数据生成 [completed：14 天/56 条餐食、7 天活动、3 条运动、3 条记忆；幂等复跑通过]
                                ├── S2 核心功能与双端 E2E 回归 [completed：照片识别 9 项、Agent 2/2、MCP 29 工具、移动视口同源]
                                └── S3 README/文档截图素材 [completed：2 张真实云端截图、7 张 UI 参考图、README 与演示索引]
                                └── C-13 - Android 拍照闭环与产品图标收口 [completed]
                                        ├── S1 相机入口、CAMERA 权限与 Debug APK [completed：Web/TypeScript/Android 构建通过；ADB 设备待接入]
                                        ├── S2 产品图标设计与 Web/Android 资源接入 [completed：内置图像生成 + 512/1024 Web 资源 + Android 多密度资源]
                                        └── S3 真机 ADB 拍照识别闭环与最终发布检查 [completed：foodtest AVD 登录、原生相机、识别审核保存与发布门禁通过]
                                                └── C-14 - 让访问门回到产品主视觉 [completed]
                                                        ├── S1 访问门重做与未认证隐藏导航 [completed：品牌入口 + 分栏表单 + API 安全边界不变]
                                                        └── S2 Web/Android 尺寸回归与截图 [completed：云端静态资源、API 401、模拟器访问门截图与生产构建均通过]
                                                └── C-15 - 访问门高级入口视觉收口 [completed]
                                                        └── S1 紧凑入口表面、云端发布与模拟器回归 [completed]
                                                └── C-16 - 访问门背景材质补强 [completed]
                                                        └── S1 接入餐食摄影背景与模拟器回归 [completed]
                                                └── C-17 - 账户体系、邀请码注册与跨账户数据隔离 [completed]
                                                        ├── A1 账户/会话/邀请码数据模型 [completed]
                                                        ├── S1 认证核心 API、会话门与安全边界 [completed]
                                                        ├── S2 业务数据与 AI/MCP 配置按账户隔离 [completed]
                                                        ├── S3 登录、邀请码注册、退出与认证 UI [completed]
                                                        └── S4 云端迁移、双端同步与最终发布检查 [completed：云端公网、账户同步、Android 云壳构建与 release gate]
```


