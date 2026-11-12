# 图片、浏览器操作与桌面操作

[English](browser-and-desktop.md) | 中文

本指南介绍 agent 如何读取你的图片、操作网页浏览器，以及观察并操作桌面窗口。图片无需任何设置即可使用；浏览器操作与桌面操作**默认关闭**，需要通过 overlay 分别开启。

## 图片

在输入框中附加 PNG、JPG、WebP 或 GIF 图片。AH 将其保存在你的机器上，并在历史中再次显示。

- 支持图片的模型（例如 DeepSeek-V4.1-Flash）直接接收图片本身。
- 纯文本模型（例如 DeepSeek-V4-Pro）接收由[视觉桥接](../../../packages/llm/llm-vision-bridge/README.zh.md)撰写的描述。随附组合使用 DeepSeek-V4.1-Flash 生成描述；可以将桥接的 `provider` 与 `model` 设为你在 [Models 页面](providers.zh.md)配置的任一支持图片的路由，包括 OpenAI 兼容网关。

Agent（智能体）用 `read_image` 工具自行打开图片文件（例如工作区中的截图）时，规则相同：支持图片的模型接收图片本身，纯文本模型接收视觉桥接的描述。在 Models 页面添加、但未声明图片输入的模型按纯文本模型处理。

要为单个 profile 更换描述模型，在 `$AH_HOME/profiles/<name>/cordis.patch.yml` 中加入以下 patch：

```yaml
- id: llm-vision-bridge
  config:
    provider: <your-route>
    model: <image-capable-model>
```

## 浏览器操作

agent 通过 [Playwright MCP](../../../packages/experimental/browser-use-playwright-mcp/README.zh.md) 驱动 Chromium。每个 Session 拥有自己的无头浏览器，并随 Session 关闭。

1. 在仓库根目录为固定版本的 Playwright 安装 Chromium：

   ```sh
   cd packages/experimental/browser-use-playwright-mcp
   node -e "const {dirname,join}=require('node:path');const core=dirname(require.resolve('playwright-core/package.json',{paths:[require.resolve('@playwright/mcp/package.json')]}));require('node:child_process').execFileSync(process.execPath,[join(core,'cli.js'),'install','chromium'],{stdio:'inherit'})"
   cd -
   ```

   在 Linux 与 WSL 上，Chromium 还需要系统库（例如 `libnspr4` 与 `libnss3`）。请使用 Playwright 的依赖安装器安装一次，它会要求输入你的密码：

   ```sh
   sudo "$(command -v node)" "$(node -e "const {dirname,join}=require('node:path');const core=dirname(require.resolve('playwright-core/package.json',{paths:[require.resolve('@playwright/mcp/package.json')]}));console.log(join(core,'cli.js'))")" install-deps chromium
   ```

2. 使用 overlay 启动 AH：

   ```sh
   ah web --patch "$PWD/apps/cli/config/examples/browser-use/playwright.cordis.yml"
   ```

要操作你已在使用的 Chrome（包括其标签页与登录状态），请以 `--remote-debugging-port=9222` 启动 Chrome，并改用 `playwright-attach.cordis.yml`。AH 复用该浏览器且从不关闭它。

## 桌面操作

agent 通过原生 [Cua Driver](../../../packages/experimental/computer-use-cua-driver-native/README.zh.md) 运行时观察并操作窗口，该运行时提供 macOS、Linux 与 Windows 的二进制文件。

```sh
ah web --patch "$PWD/apps/cli/config/examples/desktop-use/cua-driver-native.cordis.yml"
```

AH 控制其运行所在机器与登录会话的桌面：

- **Windows 应用**需要直接在 Windows 上运行 AH，而不是在 WSL 中运行。
- **在 WSL 中**，agent 只能访问 WSLg 的 Linux 桌面。
- **macOS** 会要求你为启动 AH 的应用授予屏幕录制与辅助功能权限。

当所选模型接受图片时，截图会送达模型；使用纯文本模型时，请为桌面任务选择支持图片的模型。

## 跨次运行保留选择

`--patch` 只对一次运行生效。要保留某个 overlay，请将其 `insert` patch 合并到 `$AH_HOME/profiles/<name>/cordis.patch.yml`（单个 profile）或 `$AH_HOME/cordis.patch.yml`（本机所有 profile）。

## 安全

浏览器与桌面工具会以你的账户身份、在你的文件上执行操作。请保持工具审批开启，检查 agent 即将执行的操作，并优先为自动化使用独立的浏览器 profile。
