import { Context } from '@anotherharness/cordis'
import type { GenerateOptions, StreamChunk } from '@anotherharness/ah-llm'
import { LlmError } from '@anotherharness/ah-llm'
import { describe, expect, it } from 'vitest'
import VisionBridge, {
  DEFAULT_INSTRUCTION, DEFAULT_MAX_TOKENS, describedImageText,
} from '../src/index.ts'
import type { ImageAttachmentRef } from '@anotherharness/ah-attachment'

const image: ImageAttachmentRef = {
  attachmentId: 'img-1', mediaType: 'image/png', bytes: 4, width: 2, height: 2,
} as never

function textReply(...parts: string[]): StreamChunk[] {
  return [
    ...parts.flatMap((text, index): StreamChunk[] => [
      { type: 'block-start', index, blockType: 'text' },
      { type: 'text-delta', index, text },
      { type: 'block-end', index, block: { type: 'text', text } },
    ]),
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

async function bridgeWith(
  reply: StreamChunk[],
  config: Record<string, unknown> = { provider: 'vision-route', model: 'vision-model' },
): Promise<{ ctx: Context; calls: GenerateOptions[] }> {
  const ctx = new Context()
  const calls: GenerateOptions[] = []
  ctx.provide('llm', {
    // oxlint-disable-next-line require-yield -- reply is replayed verbatim.
    async* stream(options: GenerateOptions) {
      calls.push(options)
      yield* reply
    },
  } as never)
  await ctx.plugin(VisionBridge, config as never)
  return { ctx, calls }
}

describe('vision bridge', () => {
  it('AC-2: describes an image with the configured route, instruction, and token cap', async () => {
    const { ctx, calls } = await bridgeWith(textReply('  A login form ', 'with a red button.  '))
    try {
      const signal = new AbortController().signal
      expect(await ctx.visionBridge.describe(image, signal)).toBe('A login form with a red button.')
      expect(calls).toHaveLength(1)
      expect(calls[0]).toMatchObject({
        provider: 'vision-route',
        model: 'vision-model',
        maxTokens: DEFAULT_MAX_TOKENS,
        signal,
        messages: [{ role: 'user', content: [{ type: 'text', text: DEFAULT_INSTRUCTION }, { type: 'image', attachment: image }] }],
      })
      expect(ctx.visionBridge.route).toEqual({ provider: 'vision-route', model: 'vision-model' })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('omits the signal when the caller supplies none and honors configured overrides', async () => {
    const { ctx, calls } = await bridgeWith(textReply('ok'), {
      provider: 'p', model: 'm', instruction: 'Only transcribe text.', maxTokens: 64,
    })
    try {
      await ctx.visionBridge.describe(image)
      expect(calls[0]).not.toHaveProperty('signal')
      expect(calls[0]?.maxTokens).toBe(64)
      expect(calls[0]?.messages[0]?.content[0]).toEqual({ type: 'text', text: 'Only transcribe text.' })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it.each(['error', 'aborted'] as const)('raises the route failure when the request finishes as %s', async (kind) => {
    const { ctx } = await bridgeWith([{
      type: 'finish',
      reason: { kind, failure: { message: 'route rejected the image', code: 'UNSUPPORTED_CONTENT' } },
    }])
    try {
      await expect(ctx.visionBridge.describe(image)).rejects.toMatchObject({
        message: 'route rejected the image', code: 'UNSUPPORTED_CONTENT',
      })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('rejects a reply without description text', async () => {
    const { ctx } = await bridgeWith([
      { type: 'block-start', index: 0, blockType: 'reasoning' },
      { type: 'reasoning-delta', index: 0, text: 'thinking' },
      { type: 'block-end', index: 0, block: { type: 'reasoning', text: 'thinking' } },
      ...textReply('   '),
    ])
    try {
      const failure = ctx.visionBridge.describe(image)
      await expect(failure).rejects.toBeInstanceOf(LlmError)
      await expect(failure).rejects.toMatchObject({ code: 'EMPTY_DESCRIPTION' })
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('requires an explicit provider and model', () => {
    expect(() => VisionBridge.Config({ model: 'm' } as never)).toThrow()
    expect(() => VisionBridge.Config({ provider: 'p' } as never)).toThrow()
    expect(VisionBridge.Config({ provider: 'p', model: 'm' })).toEqual({
      provider: 'p', model: 'm', instruction: DEFAULT_INSTRUCTION, maxTokens: DEFAULT_MAX_TOKENS,
    })
  })

  it('labels the description with the route that wrote it', () => {
    expect(describedImageText({ provider: 'p', model: 'm' }, 'A chart.')).toBe(
      '[Image description by p/m; you cannot see the image itself]\nA chart.',
    )
  })
})
