# 隐私

[English](privacy.md) | 中文

本参考文档说明 AnotherHarness 会把什么发送到你的机器之外。随附组合默认匿名且私密：除非由你直接引发，否则任何数据都不会离开机器，也没有任何请求携带你这次安装的持久身份。[规格 0002](../specs/privacy/0002-user-data-privacy-by-default.md) 记录了相关需求及其测试。

## 会离开机器的内容

只有由你引发的流量：

- 发往你在 [Models 页面](user/guide/providers.zh.md)配置的提供方的**模型请求**。每个请求携带模型所需的对话、提供方凭据、一个可选的按对话划分的会话 id（提供方可用于提示词缓存），以及标明应用的 `user-agent`。
- agent 运行的 **Web 工具**：搜索查询发往所配置的搜索提供方，被抓取的页面看到的是通用 `user-agent` `Mozilla/5.0 (compatible)`。
- 由你发起的**提供方账号登录**，例如 DeepSeek Account，它会联系该提供方的平台。
- 你自行开启的**可选能力**，例如[浏览器操作与桌面操作](user/guide/browser-and-desktop.zh.md)或 MCP 服务器。

## 永远不会离开机器的内容

- 不挂载任何遥测、产品分析或崩溃上传。
- 会话日志、反馈、评分与编辑都保留在本地会话日志中。
- 不向任何提供方发送持久的安装标识符。
- 插件安装器不会在后台探测包注册表。
- 支持链接打开所配置的页面，不附带账号、构建或设备数据。

## 面向运维者的可选能力

被移除行为背后的包仍作为 `optional` 包保留在仓库中，没有任何随附 bundle 挂载它们：`session-log-deepseek`、`session-telemetry-otel`、`otel`、`host-product-telemetry-otel`、`client-product-analytics` 与 `plugin-package-inventory-deepseek`。需要它们的运维者应在 profile patch 中显式插入对应配置行，并将任何采集端指向自己掌控的基础设施。

## 静态数据

会话、附件、凭据与设置保存在 Harness 主目录（`~/.ah`）下。凭据以仅所有者可访问的权限存储。随附组合不会上传 Harness 主目录中的任何内容。
