/** Real Loader/native adapters with fixture-owned credentials and a bounded loopback wire. */
import type { ModuleLoaderV2 } from '@anotherharness/cordis-plugin-loader'
import { boot } from '@anotherharness/ah-app-boot'
import LlmRuntime from '@anotherharness/ah-llm'
import SessionStore, { SESSION_FORMAT_VERSION, SessionId, SessionSeq, type Session, type SessionEvent, type SessionHeader } from '@anotherharness/ah-session'
import JsonlPersistence from '@anotherharness/ah-session-persistence-jsonl'
import SqliteSessionQuery from '@anotherharness/ah-session-query-sqlite'
import * as Official from '@anotherharness/ah-llm-deepseek-api-key'
import * as Account from '@anotherharness/ah-llm-deepseek-account'
import type { DeepSeekAccount } from '@anotherharness/ah-deepseek-account'
import DeepSeekLlmApiExtensionRegistry from '@anotherharness/ah-deepseek-llm-api-extensions'
import * as SessionLogDeepSeek from '@anotherharness/ah-session-log-deepseek'
import { createLaunchEnvironmentSnapshot } from '@anotherharness/ah-launch-environment'
import { once } from 'node:events'
import { createServer, type ServerResponse } from 'node:http'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Translator, { type Config } from '../src/index.ts'

/** Provider-visible request, without credential values. */
export interface NativeRequest {
  path: string
  body: Record<string, unknown>
  accountAuth: boolean
  officialAuth: boolean
  sessionHeader: boolean
  audit: readonly SessionEvent[]
}

/** Native SSE text reply; alternate stop reasons exercise incomplete output. */
export function replyEvents(text = '翻译结果', stop = 'end_turn'): Record<string, unknown>[] {
  return [
    { type: 'message_start', message: { id: 'translation-response', model: 'deepseek-flash', usage: { input_tokens: 3, output_tokens: 0 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 3 } },
    { type: 'message_stop' },
  ]
}

/** Serialize actual Messages events into the external endpoint's SSE protocol. */
export function sse(events: Record<string, unknown>[]): string {
  return events.map(event => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`).join('')
}

/** Parsed native model choices accepted by the fixture composition. */
export interface FixtureOptions {
  translator?: Partial<Config>
  officialModels?: { id: string; name: string }[]
  accountModels?: { id: string; name: string }[]
  officialName?: string
  withCredentials?: boolean
  withSession?: boolean
  withSessionQuery?: boolean
  credentialConfigured?: boolean
  ambientConfigured?: boolean
  signedIn?: boolean
  withSessionLog?: boolean
  responseStatus?: number
  reply?: (response: ServerResponse, request: NativeRequest) => void | Promise<void>
}

/** Composition choices changed only after the old Host has fully closed. */
export interface RestartOptions {
  withNativeOwners?: boolean
  translator?: Partial<Config>
}

/** Boot actual native provider rows; cleanup is registered as soon as resources exist. */
export async function paidFixture(cleanups: Array<() => Promise<void>>, options: FixtureOptions = {}) {
  const root = await mkdtemp(join(tmpdir(), 'ah-paid-translator-'))
  cleanups.push(async () => { await rm(root, { recursive: true, force: true }) })
  const previousHome = process.env.AH_HOME
  process.env.AH_HOME = root
  cleanups.push(async () => {
    if (previousHome === undefined) Reflect.deleteProperty(process.env, 'AH_HOME')
    else process.env.AH_HOME = previousHome
  })
  const requests: NativeRequest[] = [], errors: unknown[] = [], handlers = new Set<Promise<void>>()
  let auditId = SessionId('paid-translation')
  const server = createServer((request, response) => {
    const work = (async () => {
      const chunks: Buffer[] = []
      for await (const chunk of request) {
        if (!(chunk instanceof Buffer)) throw new Error('Expected HTTP body bytes')
        chunks.push(chunk)
      }
      const payload: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Expected native Messages request object')
      const input: NativeRequest = { path: request.url ?? '', body: payload as Record<string, unknown>,
        accountAuth: request.headers['x-ah-auth-token'] !== undefined, officialAuth: request.headers['x-api-key'] !== undefined,
        sessionHeader: request.headers['x-another-harness-session-id'] !== undefined,
        audit: await readEvents(auditId) }
      requests.push(input)
      response.writeHead(options.responseStatus ?? 200, { 'content-type': 'text/event-stream' })
      if (options.reply === undefined) response.end(sse(replyEvents()))
      else await options.reply(response, input)
    })().catch((error: unknown) => { errors.push(error); response.destroy() })
    handlers.add(work)
    void work.then(() => { handlers.delete(work) })
  })
  cleanups.push(async () => {
    const closed = new Promise<void>((resolve, reject) => server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    }))
    server.closeAllConnections()
    await closed
    await Promise.all(handlers)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('Expected allocated loopback listener')
  const baseURL = `http://127.0.0.1:${address.port}/anthropic`
  let configured = options.credentialConfigured ?? true, signedIn = options.signedIn ?? true
  const configPath = join(root, 'cordis.yml'), storedRoot = join(root, 'sessions')
  let translator = options.translator ?? {}, withNativeOwners = true
  const rows = () => [
    { id: 'llm', name: '@anotherharness/ah-llm' },
    { id: 'session', name: '@anotherharness/ah-session' },
    { id: 'storage', name: '@anotherharness/ah-session-persistence-jsonl', config: { root: storedRoot, compression: 'none' } },
    { id: 'official-custom-id', name: options.officialName ?? '@anotherharness/ah-llm-deepseek-api-key', disabled: !withNativeOwners, config: {
      baseURL, apiKeyEnv: 'PAID_TRANSLATION_FIXTURE_KEY', models: options.officialModels ?? [{ id: 'deepseek-flash', name: 'Flash version-independent name' }],
    } },
    { id: 'account-custom-id', name: '@anotherharness/ah-llm-deepseek-account', disabled: !withNativeOwners, config: {
      baseURL, models: options.accountModels ?? [{ id: 'deepseek-flash', name: 'Another arbitrary Flash version' }],
    } },
    { id: 'translator', name: '@anotherharness/ah-experimental-translator', config: translator },
    ...options.withSessionQuery === true ? [
      { id: 'query', name: '@anotherharness/ah-session-query-sqlite', config: { path: join(root, 'query.sqlite'), openAt: 'never' } },
    ] : [],
    ...options.withSessionLog === true ? [
      { id: 'deepseek-llm-api-extensions', name: '@anotherharness/ah-deepseek-llm-api-extensions' },
      { id: 'session-log-deepseek', name: '@anotherharness/ah-session-log-deepseek' },
    ] : [],
  ]
  await writeFile(configPath, JSON.stringify(rows()))
  const modules = new Map<string, unknown>([
    ['@anotherharness/ah-llm', LlmRuntime], ['@anotherharness/ah-session', SessionStore],
    ['@anotherharness/ah-session-persistence-jsonl', JsonlPersistence], ['@anotherharness/ah-session-query-sqlite', SqliteSessionQuery],
    [options.officialName ?? '@anotherharness/ah-llm-deepseek-api-key', Official],
    ['@anotherharness/ah-llm-deepseek-account', Account], ['@anotherharness/ah-experimental-translator', Translator],
    ['@anotherharness/ah-deepseek-llm-api-extensions', DeepSeekLlmApiExtensionRegistry],
    ['@anotherharness/ah-session-log-deepseek', SessionLogDeepSeek],
  ])
  const start = () => boot('paid-translator-composition', configPath, [], (host) => {
    const sourceModules: ModuleLoaderV2 = {
      version: 'v2', loadCache: new Map(),
      async import(specifier) {
        if (!modules.has(specifier)) throw new Error(`Unexpected fixture module ${specifier}`)
        return modules.get(specifier)
      },
      register(): never { throw new Error('Unexpected module hook registration') },
      getOrCreateModuleJob(): never { throw new Error('Unexpected module job creation') },
      resolveSync(): never { throw new Error('Unexpected synchronous module resolution') },
      load(): never { throw new Error('Unexpected module load') },
    }
    host.loader.internal = sourceModules
    host.provide('launchEnvironment', createLaunchEnvironmentSnapshot([{ source: 'process',
      values: options.ambientConfigured === false ? {} : { PAID_TRANSLATION_FIXTURE_KEY: 'fixture-native-key' } }]))
    if (options.withCredentials !== false) host.provide('credentials', {
      describe: async () => ({ configured, writable: true }),
      resolve: async () => configured ? { value: 'fixture-native-key', source: 'fixture' } : undefined,
    } as never)
    host.provide('deepseekAccount', {
      resolveToken: async (_baseURL: string): Promise<string | undefined> => signedIn ? 'fixture-account-token' : undefined,
    } as DeepSeekAccount)
  })
  let ctx = await start(), session: Session | undefined
  cleanups.push(async () => { await ctx.fiber.dispose() })
  const readEvents = async (id: SessionId): Promise<readonly SessionEvent[]> => {
    if (await ctx.sessionPersistence.stat(id) === undefined) return []
    await using handle = await ctx.sessionPersistence.open(id, 'read')
    return (await handle.read()).events
  }
  if (options.withSession !== false) {
    session = ctx.sessions.create(auditId, { meta: { cwd: root } })
    await ctx.sessionPersistence.create(session.header)
    await ctx.sessions.flush(session)
  }
  const translate = (provider: 'deepseek-account' | 'deepseek-official', text = 'Original paragraph', signal?: AbortSignal) =>
    ctx.translator.translate(ctx.translator.resolve({ text, targetLanguage: 'zh', provider,
      ...session === undefined ? {} : { sessionId: session.id } }), signal)
  return { get ctx() { return ctx }, get session() { return session }, root, requests, errors, translate, readEvents,
    async activate(id: SessionId = auditId) {
      const writer = await ctx.sessionPersistence.open(id, 'write')
      const stored = await writer.read()
      const resumed: SessionEvent = { type: 'session/end-seed', seq: SessionSeq(stored.events.length), time: Date.now(), data: {} }
      await writer.append([resumed])
      session = ctx.sessions.create(id, {
        seed: [...stored.events, resumed], meta: writer.header, inheritedEventCount: writer.inheritedEventCount,
      })
      await ctx.sessions.flush(session)
      return session
    },
    async createHistorical(id: SessionId, events: SessionEvent[]) {
      auditId = id
      const header: SessionHeader = { id, version: SESSION_FORMAT_VERSION, createdAt: 1, cwd: root, isSeeded: false, delegationDepth: 0 }
      await using handle = await ctx.sessionPersistence.create(header)
      await handle.append(events)
      await handle.flush()
      const artifacts = (await readdir(storedRoot, { recursive: true })).filter(value => value.endsWith(join(id, `session.v${SESSION_FORMAT_VERSION}.jsonl`)))
      if (artifacts.length !== 1) throw new Error('Expected one current Session artifact')
      const file = join(storedRoot, artifacts[0]!)
      return { id, header, events, file, bytes: await readFile(file) }
    },
    async restart(changes: RestartOptions = {}) {
      await ctx.fiber.dispose()
      session = undefined
      withNativeOwners = changes.withNativeOwners ?? withNativeOwners
      translator = changes.translator ?? translator
      await writeFile(configPath, JSON.stringify(rows()))
      ctx = await start()
    },
    setConfigured(value: boolean) { configured = value }, setSignedIn(value: boolean) { signedIn = value } }
}
