---
description: "由支持图片的模型路由生成图片描述，供所选模型只接受文本的部署使用。"
kind: "package-reference"
---

# @anotherharness/ah-llm-vision-bridge

[English](README.md) | 中文

## 概述

即使所选模型只接受文本，用户也可以附加图片。提示词接收时会请本服务使用任一已挂载 LLM 适配器中配置的、支持图片的路由来描述每张图片，将图片保留为持久附件，并以描述代替图片发送给纯文本模型。没有本服务时，纯文本模型仍像以前一样拒绝含图片的提示词。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [延伸阅读](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

以显式路由挂载本服务一次。随附的 base 使用 DeepSeek-V4.1-Flash 挂载它：

```yaml
- name: '@anotherharness/ah-llm-vision-bridge'
  config:
    provider: deepseek-official
    model: deepseek-flash
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `provider` | 必填 | 任一已挂载适配器的提供方路由，包括 pi-ai 提供方与 OpenAI 兼容网关 |
| `model` | 必填 | 该路由上支持图片的模型 |
| `instruction` | 内置描述指令 | 随每张图片发送的文本 |
| `maxTokens` | `1024` | 单次描述的输出 token 上限 |

`ctx.visionBridge.describe(image, signal)` 接收一个 `ImageAttachmentRef`，返回一张已存储图片的去空白描述；路由失败、被中止或未返回文本（`EMPTY_DESCRIPTION`）时抛出 `LlmError`。`describedImageText(route, description)` 构造提示词接收在图片之后记录的文本部分。`ctx.visionBridge.route` 报告所配置的路由。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

每次描述都是一个独立的 `ctx.llm.stream` 请求，其唯一消息携带指令与图片引用；路由的适配器从附件存储读取图片字节。[Session 控制器](../../api/session-controller/README.zh.md)仅在所选模型缺少图片输入时通过 `ctx.get('visionBridge')` 使用本服务。它以 `offloaded: true` 记录图片，因此每条路由都发送图片的占位文本而不是字节，随后是描述文本部分。

</details>

-----

<a id="further-exploration"></a>
## 延伸阅读

- [附件子系统](../../../docs/subsystems/attachment.zh.md)——持久图片引用与卸载占位文本。
- [规格 0001](../../../specs/multimodal/0001-vision-browser-desktop.md)——视觉、浏览器操作与桌面操作的需求与验收标准。

-----

<a id="model-experience"></a>
## 模型体验

### 图片描述请求

#### 模型看到的内容

所配置的支持图片的路由收到一条用户消息，其中包含指令与图片。默认指令为：

##### 默认指令原文

```markdown
Describe this image for an assistant that cannot see it. Transcribe all visible text exactly, then describe the layout, interface elements, diagrams, charts, and any other detail needed to answer questions about it. Describe only what is visible.
```

#### Token 影响

每张附加图片产生一次辅助请求：指令、提供方的图片 token，以及至多 `maxTokens` 个输出 token。

#### KV Cache 影响

每次描述都是独立请求，不触及对话的请求前缀。

### 用户消息中的描述

#### 模型看到的内容

纯文本路由看到被卸载图片的占位文本，随后是 `[Image description by <provider>/<model>; you cannot see the image itself]`、一个换行与描述文本。

#### Token 影响

描述将其自身长度一次性加入用户消息，该消息在 Session 的剩余部分中保留它。

#### KV Cache 影响

该文本属于新追加的用户消息，因此请求以仅追加方式增长，较早的请求 token 保持不变。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- **较早的图片**——历史中来自支持图片模型轮次的图片仍需要支持图片的路由；只有在选择纯文本模型时附加的图片才会被描述。
- **其他入口**——子 agent 与 ACP 提示词保留现有的图片检查，不使用该桥接。
- **有损文本**——描述无法承载全部视觉细节；之后切换到支持图片的模型时，原图只在未被卸载的位置发送。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>
