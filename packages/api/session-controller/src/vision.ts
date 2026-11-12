import { describedImageText, type VisionBridge } from '@anotherharness/ah-llm-vision-bridge'
import type { UserMessage } from '@anotherharness/ah-session'
import { RemoteError } from '@anotherharness/ah-typert-protocol'

/**
 * Replace each stored image with its offloaded placeholder plus a description,
 * so a text-only route receives what the image shows.
 * @param bridge - the mounted vision bridge.
 * @param content - admitted user content whose images are already stored.
 * @param signal - prompt admission cancellation.
 * @returns content in which every non-offloaded image is followed by its description text.
 * @throws RemoteError `session/attachment-invalid` with reason `IMAGE_DESCRIPTION_FAILED` when a description fails.
 */
export async function describeImages(
  bridge: VisionBridge,
  content: UserMessage['content'],
  signal?: AbortSignal,
): Promise<UserMessage['content']> {
  const described: UserMessage['content'][number][] = []
  for (const block of content) {
    if (block.type !== 'image' || block.offloaded === true) {
      described.push(block)
      continue
    }
    let description: string
    try {
      description = await bridge.describe(block.attachment, signal)
    } catch (error) {
      throw new RemoteError(
        'session/attachment-invalid',
        `The image could not be described for the selected text-only model: ${error instanceof Error ? error.message : String(error)}`,
        { reason: 'IMAGE_DESCRIPTION_FAILED' },
      )
    }
    described.push({ ...block, offloaded: true }, { type: 'text', text: describedImageText(bridge.route, description) })
  }
  return described
}
