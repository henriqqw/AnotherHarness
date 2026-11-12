import { describe, expect, it } from 'vitest'
import { inferImageCapable, listedInputModalities } from '../src/vision.ts'

describe('inferImageCapable', () => {
  it('recognizes well-known vision families by id', () => {
    for (const id of [
      'gpt-4o',
      'gpt-4o-mini',
      'chatgpt-4o-latest',
      'gpt-4.1',
      'gpt-4-turbo',
      'gpt-5',
      'claude-3-5-sonnet',
      'claude-sonnet-4-20250514',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'glm-4v-plus',
      'glm-4.5v',
      'qwen2-vl-72b-instruct',
      'qwen2.5-vl-7b',
      'deepseek-vl2',
      'deepseek-v4.1-flash',
      'grok-2-vision-1212',
      'grok-4',
      'pixtral-12b-vision',
      'internvl-chat',
    ]) {
      expect(inferImageCapable(id)).toBe(true)
    }
  })

  it('matches a vision marker in the display name when the id hides it', () => {
    expect(inferImageCapable('model-xyz', 'Qwen 2 VL 72B')).toBe(true)
    expect(inferImageCapable('vendor-123', 'Some Vision Preview')).toBe(true)
  })

  it('leaves text-only and ambiguous ids unrecognized', () => {
    for (const id of [
      'gpt-3.5-turbo',
      'claude-2.1',
      'gemini-pro',
      'deepseek-chat',
      'deepseek-reasoner',
      'text-embedding-3-large',
      'llama-3.1-70b',
      'mistral-large',
      'envisioned-model',
    ]) {
      expect(inferImageCapable(id)).toBe(false)
    }
  })
})

describe('listedInputModalities', () => {
  it('believes an OpenRouter-style architecture block over any inference', () => {
    expect(listedInputModalities({ architecture: { input_modalities: ['text', 'image'] } }, 'plain-chat'))
      .toEqual(['text', 'image'])
    // A disclosed text-only set wins even for a name that would otherwise infer vision.
    expect(listedInputModalities({ architecture: { input_modalities: ['text'] } }, 'glm-4v'))
      .toEqual(['text'])
  })

  it('parses a modality pipeline string, reading only its input half', () => {
    expect(listedInputModalities({ architecture: { modality: 'text+image->text' } }, 'x')).toEqual(['text', 'image'])
    expect(listedInputModalities({ architecture: { modality: 'text->text' } }, 'x')).toEqual(['text'])
  })

  it('reads top-level modality arrays', () => {
    expect(listedInputModalities({ input_modalities: ['image'] }, 'x')).toEqual(['image'])
    expect(listedInputModalities({ modalities: ['text', 'vision'] }, 'x')).toEqual(['text', 'image'])
  })

  it('falls back to id inference when the listing discloses nothing', () => {
    expect(listedInputModalities({}, 'glm-4v-plus')).toEqual(['text', 'image'])
    expect(listedInputModalities(undefined, 'deepseek-v4.1-flash')).toEqual(['text', 'image'])
    expect(listedInputModalities({}, 'plain-chat')).toBeUndefined()
  })

  it('ignores modality names it does not map', () => {
    expect(listedInputModalities({ input_modalities: ['audio', 'video'] }, 'plain-chat')).toBeUndefined()
    expect(listedInputModalities({ input_modalities: ['text', 'audio'] }, 'plain-chat')).toEqual(['text'])
  })
})
