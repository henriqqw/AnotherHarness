import type { UserMessage } from '@anotherharness/ah-session'
import { describe, expect, it, vi } from 'vitest'
import { describeImages } from '../src/vision.ts'

const image = { attachmentId: 'img', mediaType: 'image/png', bytes: 1, width: 1, height: 1 }
const route = { provider: 'vision-route', model: 'vision-model' }

function bridge(describeImpl: (...args: unknown[]) => Promise<string>) {
  return { route, describe: vi.fn(describeImpl) } as never
}

describe('describeImages', () => {
  it('AC-2: offloads each stored image and appends its description, keeping other blocks', async () => {
    const signal = new AbortController().signal
    const describeFn = vi.fn(() => Promise.resolve('A chart.'))
    const content = [
      { type: 'text', text: 'What is this?' },
      { type: 'image', attachment: image },
      { type: 'image', attachment: image, offloaded: true },
    ] as never as UserMessage['content']
    const result = await describeImages({ route, describe: describeFn } as never, content, signal)
    expect(describeFn).toHaveBeenCalledOnce()
    expect(describeFn).toHaveBeenCalledWith(image, signal)
    expect(result).toEqual([
      { type: 'text', text: 'What is this?' },
      { type: 'image', attachment: image, offloaded: true },
      { type: 'text', text: '[Image description by vision-route/vision-model; you cannot see the image itself]\nA chart.' },
      { type: 'image', attachment: image, offloaded: true },
    ])
  })

  it.each([
    ['an Error', new Error('route offline'), 'route offline'],
    ['a non-Error value', 'plain failure', 'plain failure'],
  ])('maps %s from the bridge to IMAGE_DESCRIPTION_FAILED', async (_label, failure, message) => {
    const content = [{ type: 'image', attachment: image }] as never as UserMessage['content']
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- non-Error bridge failures are part of the scenario.
    const result = describeImages(bridge(() => Promise.reject(failure)), content)
    await expect(result).rejects.toMatchObject({
      code: 'session/attachment-invalid',
      details: { reason: 'IMAGE_DESCRIPTION_FAILED' },
    })
    await expect(result).rejects.toThrow(message)
  })
})
