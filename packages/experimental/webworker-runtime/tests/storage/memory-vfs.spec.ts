/**
 * The identity, timestamp, link, mutation, and durability-sink guarantees
 * MemoryVfs owes its consumers, asserted directly rather than through the
 * `node:fs` bridge.
 *
 * `ah-fs-local` builds a version token from `dev:ino:size:mtimeNs:ctimeNs` and
 * refuses a write whose token moved since it read. Two properties carry that:
 * `ino` identifies the entry at a path, and `mtimeMs` moves on every write. The
 * timestamp cases freeze the clock, because these writes are in memory and two
 * revisions routinely land in the same millisecond — a real-clock test passes
 * whether or not the strict increment exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryVfs } from '../../src/storage/memory.ts'
import type { VfsBigIntStats, VfsMutation, VfsMutationSink, VfsStats } from '../../src/storage/types.ts'

const identity = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).ino

const linkCount = (vfs: MemoryVfs, path: string): bigint =>
  (vfs.statSync(path, { bigint: true }) as VfsBigIntStats).nlink

const modified = (vfs: MemoryVfs, path: string): number => (vfs.statSync(path) as VfsStats).mtimeMs

afterEach(() => { vi.restoreAllMocks() })

describe('entry identity', () => {
  it('distinguishes paths and holds each identity across repeated stats', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/one.txt', 'one')
    vfs.seed('/ah/two.txt', 'two')
    const first = identity(vfs, '/ah/one.txt')
    expect(identity(vfs, '/ah/two.txt')).not.toBe(first)
    expect(identity(vfs, '/ah/one.txt')).toBe(first)
  })

  it('forgets the identities under a directory removed as a subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/skills/git/SKILL.md', '# git\n')
    const before = identity(vfs, '/ah/skills/git/SKILL.md')
    vfs.rmSync('/ah/skills', { recursive: true })
    vfs.seed('/ah/skills/git/SKILL.md', '# git rebuilt\n')
    expect(identity(vfs, '/ah/skills/git/SKILL.md')).not.toBe(before)
  })

  it('moves the source identity when a file replaces another path', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/from.txt', 'moved')
    vfs.seed('/ah/to.txt', 'replaced')
    const [source, destination] = [identity(vfs, '/ah/from.txt'), identity(vfs, '/ah/to.txt')]
    vfs.renameSync('/ah/from.txt', '/ah/to.txt')
    const renamed = identity(vfs, '/ah/to.txt')
    expect(vfs.readFileSync('/ah/to.txt', 'utf8')).toBe('moved')
    expect([renamed === source, renamed === destination]).toEqual([true, false])
  })
})

describe('modification time', () => {
  it('hydrates explicit metadata without confusing timestamps with permission bits', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/restored', 'value', { mode: 0o600, mtimeMs: 1_600_000_000_000 })
    vfs.seedDirectory('/ah/restored-directory', { mode: 0o700, mtimeMs: 1_600_000_000_001 })
    const stats = vfs.statSync('/ah/restored') as VfsStats
    const directory = vfs.statSync('/ah/restored-directory') as VfsStats
    expect([stats.mode & 0o777, stats.mtimeMs]).toEqual([0o600, 1_600_000_000_000])
    expect([directory.mode & 0o777, directory.mtimeMs]).toEqual([0o700, 1_600_000_000_001])
  })

  it('advances on every write even while the clock stands still', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/ah/log.jsonl', 'first\n')
    const seeded = modified(vfs, '/ah/log.jsonl')
    vfs.writeFileSync('/ah/log.jsonl', 'second\n')
    const written = modified(vfs, '/ah/log.jsonl')
    vfs.appendFileSync('/ah/log.jsonl', 'third\n')
    const appended = modified(vfs, '/ah/log.jsonl')
    vfs.truncateSync('/ah/log.jsonl', 6)
    const truncated = modified(vfs, '/ah/log.jsonl')
    expect([written > seeded, appended > written, truncated > appended]).toEqual([true, true, true])
    // One millisecond per revision: the increment is the minimum that separates
    // two tokens, not a coarser bump that would skew a real timestamp.
    expect(truncated - seeded).toBe(3)
  })

  it('takes the clock once the clock has passed the entry', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seed('/ah/log.jsonl', 'first\n')
    clock.mockReturnValue(1_700_000_005_000)
    vfs.writeFileSync('/ah/log.jsonl', 'second\n')
    expect(modified(vfs, '/ah/log.jsonl')).toBe(1_700_000_005_000)
  })

  it('extends truncation with zero bytes', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/file', new Uint8Array([1, 2]))
    vfs.truncateSync('/ah/file', 5)
    expect([...vfs.readFileSync('/ah/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0])
    const handle = vfs.open('/ah/file', 'r+')
    await handle.truncate(7)
    expect([...vfs.readFileSync('/ah/file') as Uint8Array]).toEqual([1, 2, 0, 0, 0, 0, 0])
  })

  it('advances a directory only when its immediate entry set changes', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/ah/workspace')
    const empty = modified(vfs, '/ah/workspace')
    vfs.writeFileSync('/ah/workspace/file.txt', 'one')
    const created = modified(vfs, '/ah/workspace')
    vfs.writeFileSync('/ah/workspace/file.txt', 'two')
    const rewritten = modified(vfs, '/ah/workspace')
    vfs.rmSync('/ah/workspace/file.txt')
    const removed = modified(vfs, '/ah/workspace')
    expect([created > empty, rewritten === created, removed > rewritten]).toEqual([true, true, true])
  })
})

describe('mutation publication', () => {
  it('publishes only committed runtime changes and keeps image seeding silent', () => {
    const vfs = new MemoryVfs()
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.seed('/ah/seeded.txt', 'seeded')
    expect(mutations).toEqual([])
    vfs.writeFileSync('/ah/seeded.txt', 'changed')
    vfs.mkdirSync('/ah/created')
    vfs.chmodSync('/ah/created', 0o700)
    vfs.renameSync('/ah/seeded.txt', '/ah/renamed.txt')
    vfs.rmSync('/ah/created', { recursive: true })
    expect(mutations.map(mutation => ({
      kind: mutation.kind,
      path: mutation.path,
      ...mutation.kind === 'write' ? { entryChanged: mutation.entryChanged } : {},
      ...mutation.kind === 'chmod' ? { mode: mutation.mode } : {},
    }))).toEqual([
      { kind: 'write', path: '/ah/seeded.txt', entryChanged: false },
      { kind: 'mkdir', path: '/ah/created' },
      { kind: 'chmod', path: '/ah/created', mode: 0o700 },
      { kind: 'remove', path: '/ah/seeded.txt' },
      { kind: 'write', path: '/ah/renamed.txt', entryChanged: true },
      { kind: 'remove', path: '/ah/created' },
    ])
    const renamed = mutations[4]
    expect(renamed?.kind === 'write' && new TextDecoder().decode(renamed.bytes)).toBe('changed')
    expect(() => { vfs.writeFileSync('/missing/file', 'no') }).toThrow(/ENOENT/)
    expect(mutations).toHaveLength(6)
  })

  it('contains a faulty observer and lets disposal stop later notifications', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/ah')
    const reported = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vfs.subscribe(() => { throw new Error('observer failed') })
    const seen: string[] = []
    const second = vfs.subscribe((mutation) => { seen.push(mutation.path) })
    vfs.writeFileSync('/ah/one', '1')
    first()
    second()
    vfs.writeFileSync('/ah/two', '2')
    expect(seen).toEqual(['/ah/one'])
    expect(reported).toHaveBeenCalledOnce()
  })

  it('feeds the same complete mutations to a durable sink and live subscribers', async () => {
    const recorded: VfsMutation[] = []
    let flushes = 0
    const sink: VfsMutationSink = {
      record: (mutation) => { recorded.push(mutation) },
      flush: async () => { flushes += 1 },
    }
    const vfs = new MemoryVfs({ sink })
    vfs.seedDirectory('/ah')
    const observed: VfsMutation[] = []
    vfs.subscribe((mutation) => { observed.push(mutation) })
    vfs.writeFileSync('/ah/log', 'a')
    vfs.appendFileSync('/ah/log', 'bc')
    await vfs.flush()
    expect(observed).toEqual(recorded)
    expect(observed[0]).toBe(recorded[0])
    expect(recorded[0]).toMatchObject({ kind: 'write', path: '/ah/log', mode: 0o644, entryChanged: true })
    expect(recorded[1]).toMatchObject({ kind: 'write', path: '/ah/log', mode: 0o644, entryChanged: false, appendedFrom: 1 })
    expect(recorded[1]?.kind === 'write' && new TextDecoder().decode(recorded[1].bytes)).toBe('abc')
    expect(flushes).toBe(1)
  })

  it('publishes descriptor writes at the file identity current path', () => {
    const mutations: VfsMutation[] = []
    const vfs = new MemoryVfs()
    vfs.seed('/ah/source', 'old')
    const descriptor = vfs.openFileSync('/ah/source', 'r+')
    vfs.subscribe((mutation) => { mutations.push(mutation) })
    vfs.renameSync('/ah/source', '/ah/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('new'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/ah/destination'])
    expect(vfs.readFileSync('/ah/destination', 'utf8')).toBe('new')
    vfs.unlinkSync('/ah/destination')
    mutations.length = 0
    descriptor.write(0, new TextEncoder().encode('detached'))
    expect(mutations).toEqual([])
    expect(new TextDecoder().decode(descriptor.read(0, descriptor.stat().size))).toBe('detached')
  })

  it('reports the path identity through a BigInt file handle stat', async () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/session.lock', '')
    const handle = vfs.open('/ah/session.lock', 'w')
    const held = await handle.stat({ bigint: true }) as VfsBigIntStats
    const current = vfs.statSync('/ah/session.lock', { bigint: true }) as VfsBigIntStats

    expect([held.dev, held.ino]).toEqual([current.dev, current.ino])
    await handle.chmod(0o600)
    expect((vfs.statSync('/ah/session.lock') as VfsStats).mode & 0o777).toBe(0o600)
    await handle.close()
  })

  it('decomposes a directory rename into replayable destination state', () => {
    const recorded: VfsMutation[] = []
    const vfs = new MemoryVfs({
      sink: { record: (mutation) => { recorded.push(mutation) }, flush: () => Promise.resolve() },
    })
    vfs.seedDirectory('/ah/staging/nested', { mode: 0o700 })
    vfs.seed('/ah/staging/nested/file', 'value', { mode: 0o600 })
    vfs.renameSync('/ah/staging', '/ah/published')

    expect(recorded.map(mutation => [mutation.kind, mutation.path])).toEqual([
      ['remove', '/ah/staging'],
      ['mkdir', '/ah/published'],
      ['mkdir', '/ah/published/nested'],
      ['write', '/ah/published/nested/file'],
    ])
    expect(recorded[3]).toMatchObject({ kind: 'write', mode: 0o600, entryChanged: true })
    expect(recorded[3]?.kind === 'write' && new TextDecoder().decode(recorded[3].bytes)).toBe('value')
  })
})

describe('directory rename', () => {
  it('rejects file, non-empty directory, and missing-parent destinations before mutation', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/source/nested/file', 'source')
    vfs.seed('/ah/file', 'destination')
    vfs.seed('/ah/non-empty/child', 'destination')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    expect(() => { vfs.renameSync('/ah/source', '/ah/file') })
      .toThrow(expect.objectContaining({ code: 'ENOTDIR' }))
    expect(() => { vfs.renameSync('/ah/source', '/ah/non-empty') })
      .toThrow(expect.objectContaining({ code: 'ENOTEMPTY' }))
    expect(() => { vfs.renameSync('/ah/source', '/missing/destination') })
      .toThrow(expect.objectContaining({ code: 'ENOENT' }))

    expect(vfs.readFileSync('/ah/source/nested/file', 'utf8')).toBe('source')
    expect(vfs.readFileSync('/ah/file', 'utf8')).toBe('destination')
    expect(vfs.readFileSync('/ah/non-empty/child', 'utf8')).toBe('destination')
    expect(mutations).toEqual([])
  })

  it('replaces an empty directory with the source subtree', () => {
    const vfs = new MemoryVfs()
    vfs.seedDirectory('/ah/source/nested', { mode: 0o700 })
    vfs.seed('/ah/source/nested/file', 'source')
    vfs.seedDirectory('/ah/destination', { mode: 0o711 })

    vfs.renameSync('/ah/source', '/ah/destination')

    expect(vfs.existsSync('/ah/source')).toBe(false)
    expect(vfs.readFileSync('/ah/destination/nested/file', 'utf8')).toBe('source')
    expect((vfs.statSync('/ah/destination') as VfsStats).mode & 0o777).toBe(0o755)
    expect((vfs.statSync('/ah/destination/nested') as VfsStats).mode & 0o777).toBe(0o700)
  })
})

describe('hard links', () => {
  it('shares identity, bytes, and mode until one name is removed', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/session.jsonl', 'committed\n')
    vfs.linkSync('/ah/session.jsonl', '/ah/session-latest.jsonl')
    vfs.linkSync('/ah/session-latest.jsonl', '/ah/session-archive.jsonl')
    expect(identity(vfs, '/ah/session-latest.jsonl')).toBe(identity(vfs, '/ah/session.jsonl'))
    expect(linkCount(vfs, '/ah/session.jsonl')).toBe(3n)
    expect(vfs.readFileSync('/ah/session-latest.jsonl', 'utf8')).toBe('committed\n')
    const changedPaths: string[] = []
    vfs.subscribe((mutation) => { changedPaths.push(mutation.path) })
    vfs.appendFileSync('/ah/session.jsonl', 'appended\n')
    expect(changedPaths).toEqual([
      '/ah/session.jsonl',
      '/ah/session-latest.jsonl',
      '/ah/session-archive.jsonl',
    ])
    expect(vfs.readFileSync('/ah/session.jsonl', 'utf8')).toBe('committed\nappended\n')
    expect(vfs.readFileSync('/ah/session-latest.jsonl', 'utf8')).toBe('committed\nappended\n')
    vfs.chmodSync('/ah/session-latest.jsonl', 0o600)
    expect((vfs.statSync('/ah/session.jsonl') as VfsStats).mode & 0o777).toBe(0o600)
    vfs.unlinkSync('/ah/session-latest.jsonl')
    expect(linkCount(vfs, '/ah/session.jsonl')).toBe(2n)
    vfs.unlinkSync('/ah/session-archive.jsonl')
    expect(linkCount(vfs, '/ah/session.jsonl')).toBe(1n)
    expect(vfs.readFileSync('/ah/session.jsonl', 'utf8')).toBe('committed\nappended\n')
  })

  it('treats rename between names of the same node as a no-op', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/source', 'value')
    vfs.linkSync('/ah/source', '/ah/alias')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    vfs.renameSync('/ah/source', '/ah/alias')

    expect(vfs.readFileSync('/ah/source', 'utf8')).toBe('value')
    expect(vfs.readFileSync('/ah/alias', 'utf8')).toBe('value')
    expect(linkCount(vfs, '/ah/source')).toBe(2n)
    expect(mutations).toEqual([])
  })

  it('retargets linked names through file replacement and directory moves', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/replacement', 'replacement')
    vfs.seed('/ah/target', 'old')
    vfs.linkSync('/ah/target', '/ah/target-alias')
    const replaced = vfs.openFileSync('/ah/target', 'r+')
    vfs.renameSync('/ah/replacement', '/ah/target')
    const mutations: VfsMutation[] = []
    vfs.subscribe((mutation) => { mutations.push(mutation) })

    replaced.write(0, new TextEncoder().encode('changed'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/ah/target-alias'])
    expect(vfs.readFileSync('/ah/target', 'utf8')).toBe('replacement')
    expect(vfs.readFileSync('/ah/target-alias', 'utf8')).toBe('changed')
    expect(linkCount(vfs, '/ah/target-alias')).toBe(1n)

    vfs.seed('/ah/tree/file', 'tree')
    vfs.linkSync('/ah/tree/file', '/ah/outside')
    const moved = vfs.openFileSync('/ah/tree/file', 'r+')
    vfs.renameSync('/ah/tree', '/ah/moved')
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('moved'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/ah/outside', '/ah/moved/file'])
    expect(linkCount(vfs, '/ah/moved/file')).toBe(2n)

    vfs.rmSync('/ah/moved', { recursive: true })
    mutations.length = 0
    moved.write(0, new TextEncoder().encode('kept!'))
    expect(mutations.map(mutation => mutation.path)).toEqual(['/ah/outside'])
    expect(vfs.readFileSync('/ah/outside', 'utf8')).toBe('kept!')
    expect(linkCount(vfs, '/ah/outside')).toBe(1n)
  })

  it('rejects renaming a file over an existing directory', () => {
    const vfs = new MemoryVfs()
    vfs.seed('/ah/file', 'value')
    vfs.seedDirectory('/ah/directory')
    expect(() => { vfs.renameSync('/ah/file', '/ah/directory') }).toThrow(expect.objectContaining({ code: 'EISDIR' }))
    expect(vfs.readFileSync('/ah/file', 'utf8')).toBe('value')
    expect(vfs.statSync('/ah/directory').isDirectory()).toBe(true)
  })
})
