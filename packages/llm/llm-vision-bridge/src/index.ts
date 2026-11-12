/**
 * Image descriptions from a configured image-capable model, so text-only
 * model routes can still receive what the user's images show.
 * @module @anotherharness/ah-llm-vision-bridge
 */

import { Context, Service } from '@anotherharness/cordis'
import z from '@anotherharness/schemastery'
import { BlockAssembler, LlmError } from '@anotherharness/ah-llm'
import type { RequestMessage } from '@anotherharness/ah-llm'
import type { ImageAttachmentRef } from '@anotherharness/ah-attachment'

declare module '@anotherharness/cordis' {
  interface Context {
    visionBridge: VisionBridge
  }
}

/** Model route that produces descriptions. */
export interface VisionBridgeRoute {
  /** Registered provider route of any mounted LLM adapter. */
  readonly provider: string
  /** Image-capable model id on that route. */
  readonly model: string
}

/** Plugin configuration as written in a profile. */
export interface Config extends VisionBridgeRoute {
  /** Instruction sent with each image; defaults to {@link DEFAULT_INSTRUCTION}. */
  readonly instruction?: string
  /** Output token cap for one description; defaults to {@link DEFAULT_MAX_TOKENS}. */
  readonly maxTokens?: number
}

/** Plugin configuration after defaults are applied. */
export interface ResolvedConfig extends VisionBridgeRoute {
  /** Instruction sent with each image. */
  readonly instruction: string
  /** Output token cap for one description. */
  readonly maxTokens: number
}

/** Instruction used when the profile does not override `instruction`. */
export const DEFAULT_INSTRUCTION = 'Describe this image for an assistant that cannot see it. Transcribe all visible text exactly, '
  + 'then describe the layout, interface elements, diagrams, charts, and any other detail needed to answer questions about it. '
  + 'Describe only what is visible.'

/** Default output token cap for one description. */
export const DEFAULT_MAX_TOKENS = 1024

/**
 * Text placed after an offloaded image for a text-only route.
 * @param route - the model route that wrote the description.
 * @param description - the non-empty description text.
 * @returns the model-visible text part recorded in the user message.
 */
export function describedImageText(route: VisionBridgeRoute, description: string): string {
  return `[Image description by ${route.provider}/${route.model}; you cannot see the image itself]\n${description}`
}

/** Describes images with the configured image-capable model route. */
export class VisionBridge extends Service {
  static inject = ['llm']

  static Config: z<Config, ResolvedConfig> = z.object({
    provider: z.string().min(1).required(),
    model: z.string().min(1).required(),
    instruction: z.string().min(1).default(DEFAULT_INSTRUCTION),
    maxTokens: z.natural().min(1).default(DEFAULT_MAX_TOKENS),
  })

  /**
   * @param ctx - plugin context providing `ctx.llm`.
   * @param config - validated route, instruction, and token cap.
   */
  constructor(ctx: Context, private readonly config: ResolvedConfig) {
    super(ctx, 'visionBridge')
  }

  /** The route used for every description. */
  get route(): VisionBridgeRoute {
    return { provider: this.config.provider, model: this.config.model }
  }

  /**
   * Describe one stored image.
   * @param image - durable attachment reference readable by the route's adapter.
   * @param signal - caller cancellation for the model request.
   * @returns the trimmed description text.
   * @throws LlmError when the request fails, is aborted, or returns no text.
   */
  async describe(image: ImageAttachmentRef, signal?: AbortSignal): Promise<string> {
    const messages: RequestMessage[] = [{
      role: 'user',
      content: [{ type: 'text', text: this.config.instruction }, { type: 'image', attachment: image }],
    }]
    const assembler = new BlockAssembler()
    for await (const chunk of this.ctx.llm.stream({
      provider: this.config.provider,
      model: this.config.model,
      messages,
      maxTokens: this.config.maxTokens,
      ...signal === undefined ? {} : { signal },
    })) assembler.push(chunk)
    const finish = assembler.finish
    if (finish.kind === 'error' || finish.kind === 'aborted') {
      throw new LlmError(finish.failure.message, finish.failure.code, finish.failure)
    }
    const text = assembler.blocks()
      .flatMap(block => (block.type === 'text' ? [block.text] : []))
      .join('')
      .trim()
    if (text.length === 0) {
      throw new LlmError(`vision bridge model "${this.config.model}" returned no description`, 'EMPTY_DESCRIPTION')
    }
    return text
  }
}

export default VisionBridge
