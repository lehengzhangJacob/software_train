# Campaign: nutrition-agent

- 当前合同：`C-14 - 让访问门回到产品主视觉 [in_progress]`
- 当前切片：`C-14-S2 - Web/Android 尺寸回归与截图`
- 下一步：完成访问门回归后返回 `C-13-S3` 模拟器拍照测试
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
                                └── C-13 - Android 拍照闭环与产品图标收口 [in_progress]
                                        ├── S1 相机入口、CAMERA 权限与 Debug APK [completed：Web/TypeScript/Android 构建通过；ADB 设备待接入]
                                        ├── S2 产品图标设计与 Web/Android 资源接入 [completed：内置图像生成 + 512/1024 Web 资源 + Android 多密度资源]
                                        └── S3 真机 ADB 拍照识别闭环与最终发布检查 [paused：转模拟器后待续]
                                                └── C-14 - 让访问门回到产品主视觉 [in_progress]
                                                        ├── S1 访问门重做与未认证隐藏导航 [completed：品牌入口 + 分栏表单 + API 安全边界不变]
                                                        └── S2 Web/Android 尺寸回归与截图 [in_progress]
```


