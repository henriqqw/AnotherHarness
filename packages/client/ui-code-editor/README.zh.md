---
description: "ah Web 客户端中用于工作区文件的 CodeMirror 6 代码编辑器：在右侧 Sidebar 预览中编辑并保存，支持 VS Code 快捷键、带版本保护的保存、冲突处理和语言服务器导航。"
kind: "package-reference"
---

# @anotherharness/ah-client-ui-code-editor

[English](README.md) | 中文

## 概述

在右侧 Sidebar 中编辑工作区文件。源代码文件在 CodeMirror 6 编辑器中打开，选择**编辑**之前为只读；保存受编辑器加载时的版本保护，因此用户和代理都不会在不知情时覆盖对方的更改。Sidebar 的标签页和全屏模式就是编辑区域。

## 目录

- [注册了什么](#what-it-registers)
- [编辑与保存](#editing-and-saving)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="what-it-registers"></a>
## 注册了什么

- **两个文档渲染器**，注册在 [`ctx.documentPreviews`](../ui-sidebar-documentpreview/README.zh.md) 上：`@anotherharness/ah-client-ui-code-editor` 位于 `extension` 档，用于源代码和文本文件，因此默认打开，只读代码预览作为**代码**留在查看器菜单中；`…/alternative` 位于 `builtin` 档，用于有渲染视图的文件（Markdown、HTML、CSV、notebook、SVG），渲染视图仍为默认，并在旁边提供**编辑器**。超过 1 MiB 的文件会被拒绝，并提示使用**代码**。两者都延迟加载渲染器：CodeMirror 及其语法在首次打开时随 `client.EditorBody.js` 分块到达。
- **一个关闭守卫**，通过 `ctx.sidebarRight.registerCloseGuard` 作用于 `text` 标签页类型：关闭文件有未保存更改的标签页时，标签页保留并打开“保存 / 不保存 / 取消”对话框，该对话框以 `codeEditor.close-prompt` 注册在 `shell.overlay` 中。
- **一个监听器**，监听 [`ui-sidebar-files`](../ui-sidebar-files/README.zh.md) 发出的 `workspace-file/moved`：重命名后，草稿移到新地址，标签页在新地址重新打开；删除后，标签页关闭，有未保存更改时先询问。
- **一个 `beforeunload` 守卫**，在有未保存草稿时生效。
- `codeEditor` 本地化命名空间中的**文案**（zh、en）。

`src/client/` 下的源文件：`drafts.ts`（按文件的草稿和视图状态，不依赖 React）、`files.ts`（通过 [`workspaceFiles` Remote](../../api/workspace-files/README.zh.md) 读取、保存、全部保存和 `navigate`）、`text-codec.ts`（UTF-8、BOM 和行尾）、`close-prompt.ts` 与 `ClosePrompt.tsx`（关闭流程）、`follow-moves.ts`、`navigation.ts`（语言服务器目标）、`file-editor.ts`（`FileEditor` 背后的 CodeMirror 组合）、`languages.ts`、`EditorBody.tsx`、`CompareView.tsx` 和 `index.ts`（接线）。

<a id="editing-and-saving"></a>
## 编辑与保存

编辑器组合了 CodeMirror 的 `basicSetup`、VS Code 键位映射、搜索和替换、单词补全、缩进参考线、缩略图（宽度达到 520px 时显示）以及约三十种语言模式。颜色来自客户端主题令牌。状态栏显示光标、选区和光标数量，并可切换缩进、行尾、语言和空白显示。

草稿以文件地址为键，生命周期长于其标签页：切换标签页会恢复文本、选区和滚动位置。保存时把完整文本连同草稿的基准版本发送给 `workspaceFiles.write`；遇到 `workspace-file/conflict` 时保留草稿并显示横幅，提供重新加载、比较（通过 `@codemirror/merge` 并排显示）和覆盖。变更流会静默重新加载干净的草稿，并把有更改的草稿标记为冲突。保存时恢复行尾和字节顺序标记。Ctrl/Cmd+Alt+S 保存所有不处于冲突中的已更改草稿。

`ctx.lsp` 上挂载了语言服务器时，悬停、F12 或 Ctrl/Cmd+单击，以及 Shift+F12 会调用 `workspaceFiles.navigate`。只有一个定义时直接在对应行打开；有多个定义时，以及所有引用列表，都显示在编辑器下方的面板中。第一次收到 `workspace-file/no-language-server` 回答后，该视图会关闭这些操作。多光标点击使用 Alt+单击，与 VS Code 一致。

<a id="model-experience"></a>
## 模型体验

无，因为此包在浏览器中编辑文件，不注册任何面向模型的内容。代理读取文件后用户又保存了该文件时，代理下一次写入会收到现有的版本过期拒绝，并重新读取文件。

#### KV Cache 影响

无；编辑器流量通过 Remote 传输，不组装任何模型请求。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>
- **仅限文本。** 二进制文件、非 UTF-8 文本以及超过 `workspace-files.maxEditableBytes` 的文件打开时显示拒绝提示。
- **没有语言服务器补全或诊断。** `ctx.lsp` 接缝只提供悬停和导航；补全使用文件中的单词。
- **视图的覆盖率。** `EditorBody.tsx`、`CompareView.tsx` 和 `file-editor.ts` 需要浏览器布局引擎，因此豁免逐文件覆盖率；它们的逻辑位于已覆盖的模块中。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

延迟加载的分块除自身模块外，只能从包内其他部分导入类型，否则打包器会生成插件加载器无法加载的共享分块。视图在运行时需要的辅助函数通过注入的 `files` 接口提供。

</details>
