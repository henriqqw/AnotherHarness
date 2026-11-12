import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Context } from '@anotherharness/cordis'
import { describe, expect, it } from 'vitest'
import SkillRegistry from '@anotherharness/ah-skill'
import * as SkillBadge from '@anotherharness/ah-skill-badge'

describe('ah-skill-badge', () => {
  it('registers and disposes the bundled badge skill', async () => {
    const ctx = new Context()
    await ctx.plugin(SkillRegistry)
    const fiber = await ctx.plugin(SkillBadge)
    const resourcePath = fileURLToPath(new URL('../assets/', import.meta.url))

    expect(await ctx.skills.list()).toEqual([{
      name: 'ah-badge',
      description: 'Add the official “powered by ah” badge to documents, pull requests, merge requests, and other content produced with AnotherHarness. Use whenever creating a pull request or merge request. Also use when the user asks for a ah badge, powered-by-ah attribution, or a reusable ah badge asset or snippet.',
      invocation: { modelInvocable: true, userInvocable: true },
      provider: 'ah-badge',
      source: 'bundled',
      resourceBase: { kind: 'directory', path: resourcePath },
    }])
    const loaded = await ctx.skills.get('ah-badge')
    expect(loaded?.content).toContain('Preserve the badge\'s 121×20 dimensions')
    expect(loaded?.resourceBase).toEqual({ kind: 'directory', path: resourcePath })

    await fiber.dispose()
    expect(await ctx.skills.list()).toEqual([])
  })

  it('ships the official 726×120 PNG unchanged', async () => {
    const image = await readFile(new URL('../assets/ah-badge.png', import.meta.url))
    expect(image.readUInt32BE(16)).toBe(726)
    expect(image.readUInt32BE(20)).toBe(120)
    expect(createHash('sha256').update(image).digest('hex')).toBe(
      'f2c4f5ec9cbe847c0c763545c4d839efa8485bc74203733d0a0e8259f233c653',
    )
  })
})
