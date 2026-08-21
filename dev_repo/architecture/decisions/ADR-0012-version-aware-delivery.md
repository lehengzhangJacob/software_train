# ADR-0012：版本感知交付与双端增量刷新

## 状态

accepted — C-22-A1

## 背景

食刻的 Web 与 Android 形态都消费同一套 Next.js 云端服务，但原有发布链路没有公开的
构建探测接口。浏览器刷新虽然会通过 Next 的 hash 静态资源缓存只重新取得变化资源，用户
仍不知道何时需要刷新；Android 薄壳也没有明确的 Release 入口。

## 决策

1. 以 standalone 产物中的 `.next/BUILD_ID` 作为本次服务构建的 build 真相；package version
   只负责对用户显示的语义版本。
2. 新增只读 `GET /api/app/version`，返回 `data/error`、版本、build id、Web Release 链接
   和 Android Release 链接，并强制 `Cache-Control: no-store`。它不依赖账户、Prisma 或业务数据，
   middleware 在认证门开启时只为这个接口保留匿名例外。
3. Browser 外壳负责探测与提示；当前页面的 build 由 server layout 注入，客户端在初始加载、
   focus、visibility 和低频定时器时对比远端 build。刷新仍由用户显式触发。
4. Android 继续使用 live WebView，不新增原生业务逻辑或离线同步。原生平台只改变提示文案与
   Release/Android 下载入口；APK 安装必须由用户确认，GitHub Release 不承担静默差分安装。
5. 不引入 Service Worker 或业务页面离线缓存。Next 已有的带 hash 静态资源缓存即为安全的
   增量下载机制。

## 保持不变

- 账户、餐食、Agent、记忆、MCP、Health Connect、相机和 SQLite 真相源不变。
- Android 不是独立发布真相；云端 standalone 产物仍是 Web/Android 的共同运行源。
- Issues #3–#8 继续开放，等待外部测试确认。

## 兼容与验证

- 旧 Browser 页签继续服务当前内容，下一次 focus/visibility 探测到新 build 后显示提示。
- 未认证请求只能匿名读取版本元数据，业务 API 仍按原账户门返回 401。
- 验证包括访问门合同、版本 API production smoke、Web 桌面/375px 手动验收、Android
  cloud shell 构建和 GitHub Release 入口检查。
