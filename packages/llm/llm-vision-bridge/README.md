---
description: "Image descriptions from an image-capable model route, for deployments whose selected model accepts only text."
kind: "package-reference"
---

# @anotherharness/ah-llm-vision-bridge

English | [中文](README.zh.md)

## Summary

Users can attach images even when the selected model accepts only text. Prompt admission asks this service to describe each image with a configured image-capable route from any mounted LLM adapter, keeps the image as a durable attachment, and sends the description to the text-only model in its place. Without this service, a text-only model rejects image prompts as before.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the service once with an explicit route. The shipped base mounts it with DeepSeek-V4.1-Flash:

```yaml
- name: '@anotherharness/ah-llm-vision-bridge'
  config:
    provider: deepseek-official
    model: deepseek-flash
```

| Field | Default | Meaning |
|---|---|---|
| `provider` | required | Provider route of any mounted adapter, including pi-ai providers and OpenAI-compatible gateways |
| `model` | required | Image-capable model on that route |
| `instruction` | built-in description instruction | Text sent with each image |
| `maxTokens` | `1024` | Output token cap for one description |

`ctx.visionBridge.describe(image, signal)` takes an `ImageAttachmentRef` and returns the trimmed description of one stored image or throws an `LlmError` when the route fails, is aborted, or returns no text (`EMPTY_DESCRIPTION`). `describedImageText(route, description)` builds the text part that prompt admission records after the image. `ctx.visionBridge.route` reports the configured route.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Each description is one independent `ctx.llm.stream` request whose only message carries the instruction and the image reference; the route's adapter reads the image bytes from the attachment store. The [Session controller](../../api/session-controller/README.md) consumes the service through `ctx.get('visionBridge')` only when the selected model lacks image input. It records the image with `offloaded: true`, so every route sends the image's placeholder text instead of bytes, followed by the description text part.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Attachment subsystem](../../../docs/subsystems/attachment.md) — durable image references and offloaded placeholders.
- [Spec 0001](../../../specs/multimodal/0001-vision-browser-desktop.md) — requirements and acceptance criteria for vision, browser use, and desktop use.

-----

<a id="model-experience"></a>
## Model Experience

### Image description request

#### What the model sees

The configured image-capable route receives one user message containing the instruction and the image. The default instruction is:

##### Verbatim default instruction

```markdown
Describe this image for an assistant that cannot see it. Transcribe all visible text exactly, then describe the layout, interface elements, diagrams, charts, and any other detail needed to answer questions about it. Describe only what is visible.
```

#### Token effect

Each attached image costs one auxiliary request: the instruction, the provider's image tokens, and at most `maxTokens` output tokens.

#### KV Cache effect

Each description is an independent request and does not touch the conversation's request prefix.

### Description in the user message

#### What the model sees

The text-only route sees the offloaded image placeholder followed by `[Image description by <provider>/<model>; you cannot see the image itself]`, a newline, and the description text.

#### Token effect

The description adds its own length to the user message once, and the message keeps it for the rest of the Session.

#### KV Cache effect

The text is part of a newly appended user message, so it grows the request append-only and leaves earlier request tokens unchanged.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Earlier images** — images already in history from a turn on an image-capable model still require an image-capable route; only images attached while a text-only model is selected are described.
- **Other entry points** — subagent and ACP prompts keep their existing image checks and do not use the bridge.
- **Lossy text** — a description cannot carry every visual detail; switching to an image-capable model for later turns still sends the original image only where it was not offloaded.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
