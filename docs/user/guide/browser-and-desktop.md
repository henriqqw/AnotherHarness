# Images, browser use, and desktop use

English | [中文](browser-and-desktop.zh.md)

This guide covers how agents read your images, operate a web browser, and observe and operate desktop windows. Images work with no setup; browser use and desktop use are **default-off** and you turn each one on with an overlay.

## Images

Attach PNG, JPG, WebP, or GIF images in the composer. AH stores them on your machine and shows them again in history.

- An image-capable model, such as DeepSeek-V4.1-Flash, receives the image itself.
- A text-only model, such as DeepSeek-V4-Pro, receives a description written by the [vision bridge](../../../packages/llm/llm-vision-bridge/README.md). The shipped composition uses DeepSeek-V4.1-Flash for descriptions; set the bridge's `provider` and `model` to any image-capable route you configured on the [Models page](providers.md), including OpenAI-compatible gateways.

To change the description model for one profile, add this patch to `$AH_HOME/profiles/<name>/cordis.patch.yml`:

```yaml
- id: llm-vision-bridge
  config:
    provider: <your-route>
    model: <image-capable-model>
```

## Browser use

The agent drives Chromium through [Playwright MCP](../../../packages/experimental/browser-use-playwright-mcp/README.md). Each Session gets its own headless browser that closes with the Session.

1. Install Chromium for the pinned Playwright release, from the repository root:

   ```sh
   cd packages/experimental/browser-use-playwright-mcp
   node -e "const {dirname,join}=require('node:path');const core=dirname(require.resolve('playwright-core/package.json',{paths:[require.resolve('@playwright/mcp/package.json')]}));require('node:child_process').execFileSync(process.execPath,[join(core,'cli.js'),'install','chromium'],{stdio:'inherit'})"
   cd -
   ```

   On Linux and WSL, Chromium also needs its system libraries (for example `libnspr4` and `libnss3`). Install them once with Playwright's dependency installer, which asks for your password:

   ```sh
   sudo "$(command -v node)" "$(node -e "const {dirname,join}=require('node:path');const core=dirname(require.resolve('playwright-core/package.json',{paths:[require.resolve('@playwright/mcp/package.json')]}));console.log(join(core,'cli.js'))")" install-deps chromium
   ```

2. Start AH with the overlay:

   ```sh
   ah web --patch "$PWD/apps/cli/config/examples/browser-use/playwright.cordis.yml"
   ```

To operate a Chrome you already use, with its tabs and sign-ins, start Chrome with `--remote-debugging-port=9222` and use `playwright-attach.cordis.yml` instead. AH reuses that browser and never closes it.

## Desktop use

The agent observes and operates windows through the native [Cua Driver](../../../packages/experimental/computer-use-cua-driver-native/README.md) runtime, which ships binaries for macOS, Linux, and Windows.

```sh
ah web --patch "$PWD/apps/cli/config/examples/desktop-use/cua-driver-native.cordis.yml"
```

AH controls the desktop of the machine and login session it runs in:

- **Windows applications** require running AH directly on Windows, not inside WSL.
- **Under WSL**, the agent reaches only the WSLg Linux desktop.
- **macOS** asks you to grant Screen Recording and Accessibility permissions to the application that launches AH.

Screenshots reach the model when the selected model accepts images; with a text-only model, choose an image-capable model for desktop tasks.

## Keep a choice across runs

`--patch` applies for one run. To keep an overlay, merge its `insert` patch into `$AH_HOME/profiles/<name>/cordis.patch.yml` for one profile, or `$AH_HOME/cordis.patch.yml` for every profile on the machine.

## Safety

Browser and desktop tools act with your accounts and on your files. Keep tool approval on, review what the agent is about to do, and prefer a separate browser profile for automation.
