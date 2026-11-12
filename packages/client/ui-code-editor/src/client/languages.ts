/**
 * File suffix to CodeMirror language. The grammars ship inside the editor's
 * lazy chunk, so read-only previews never download them.
 */
import type { Extension } from '@codemirror/state'
import { LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { rust } from '@codemirror/lang-rust'
import { go } from '@codemirror/lang-go'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { sql } from '@codemirror/lang-sql'
import { php } from '@codemirror/lang-php'
import { xml } from '@codemirror/lang-xml'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { diff } from '@codemirror/legacy-modes/mode/diff'
import { csharp, kotlin } from '@codemirror/legacy-modes/mode/clike'

/** One editor language: its display name and a loader for its CodeMirror support. */
export interface EditorLanguage {
  /** Stable identifier shown in the status bar menu. */
  readonly id: string
  /** Human-readable name. */
  readonly name: string
  /** Load the CodeMirror extension; resolves to an empty extension for plain text. */
  readonly load: () => Promise<Extension>
}

const legacy = (parser: StreamParser<unknown>): Extension => new LanguageSupport(StreamLanguage.define(parser))

/** Id of the plain-text fallback; views show its localized name. */
export const FALLBACK_LANGUAGE_ID = 'plaintext'

const PLAIN_TEXT: EditorLanguage = { id: FALLBACK_LANGUAGE_ID, name: FALLBACK_LANGUAGE_ID, load: () => Promise.resolve([]) }

/** Every language the editor offers, plain text first. */
export const EDITOR_LANGUAGES: readonly EditorLanguage[] = [
  PLAIN_TEXT,
  { id: 'typescript', name: 'TypeScript', load: () => Promise.resolve(javascript({ typescript: true })) },
  { id: 'tsx', name: 'TypeScript JSX', load: () => Promise.resolve(javascript({ typescript: true, jsx: true })) },
  { id: 'javascript', name: 'JavaScript', load: () => Promise.resolve(javascript()) },
  { id: 'jsx', name: 'JavaScript JSX', load: () => Promise.resolve(javascript({ jsx: true })) },
  { id: 'json', name: 'JSON', load: () => Promise.resolve(json()) },
  { id: 'python', name: 'Python', load: () => Promise.resolve(python()) },
  { id: 'css', name: 'CSS', load: () => Promise.resolve(css()) },
  { id: 'html', name: 'HTML', load: () => Promise.resolve(html()) },
  { id: 'markdown', name: 'Markdown', load: () => Promise.resolve(markdown()) },
  { id: 'yaml', name: 'YAML', load: () => Promise.resolve(yaml()) },
  { id: 'rust', name: 'Rust', load: () => Promise.resolve(rust()) },
  { id: 'go', name: 'Go', load: () => Promise.resolve(go()) },
  { id: 'java', name: 'Java', load: () => Promise.resolve(java()) },
  { id: 'cpp', name: 'C/C++', load: () => Promise.resolve(cpp()) },
  { id: 'sql', name: 'SQL', load: () => Promise.resolve(sql()) },
  { id: 'php', name: 'PHP', load: () => Promise.resolve(php()) },
  { id: 'xml', name: 'XML', load: () => Promise.resolve(xml()) },
  { id: 'shell', name: 'Shell', load: () => Promise.resolve(legacy(shell)) },
  { id: 'dockerfile', name: 'Dockerfile', load: () => Promise.resolve(legacy(dockerFile)) },
  { id: 'toml', name: 'TOML', load: () => Promise.resolve(legacy(toml)) },
  { id: 'powershell', name: 'PowerShell', load: () => Promise.resolve(legacy(powerShell)) },
  { id: 'ruby', name: 'Ruby', load: () => Promise.resolve(legacy(ruby)) },
  { id: 'lua', name: 'Lua', load: () => Promise.resolve(legacy(lua)) },
  { id: 'swift', name: 'Swift', load: () => Promise.resolve(legacy(swift)) },
  { id: 'kotlin', name: 'Kotlin', load: () => Promise.resolve(legacy(kotlin)) },
  { id: 'csharp', name: 'C#', load: () => Promise.resolve(legacy(csharp)) },
  { id: 'properties', name: 'Properties / INI', load: () => Promise.resolve(legacy(properties)) },
  { id: 'diff', name: 'Diff', load: () => Promise.resolve(legacy(diff)) },
]

const BY_SUFFIX: Readonly<Record<string, string>> = {
  ts: 'typescript', mts: 'typescript', cts: 'typescript', tsx: 'tsx',
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx',
  json: 'json', jsonc: 'json', json5: 'json',
  py: 'python', pyi: 'python', pyw: 'python',
  css: 'css', scss: 'css', less: 'css',
  html: 'html', htm: 'html', vue: 'html', svelte: 'html',
  md: 'markdown', markdown: 'markdown', mdx: 'markdown',
  yml: 'yaml', yaml: 'yaml',
  rs: 'rust', go: 'go', java: 'java',
  c: 'cpp', h: 'cpp', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  sql: 'sql', php: 'php',
  xml: 'xml', svg: 'xml', xsl: 'xml', plist: 'xml', csproj: 'xml',
  sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  toml: 'toml', ps1: 'powershell', psm1: 'powershell',
  rb: 'ruby', lua: 'lua', swift: 'swift', kt: 'kotlin', kts: 'kotlin', cs: 'csharp',
  ini: 'properties', cfg: 'properties', conf: 'properties', properties: 'properties', env: 'properties',
  diff: 'diff', patch: 'diff',
}

const BY_NAME: Readonly<Record<string, string>> = {
  dockerfile: 'dockerfile', containerfile: 'dockerfile', makefile: 'shell',
  '.bashrc': 'shell', '.zshrc': 'shell', '.profile': 'shell', '.env': 'properties',
  '.gitignore': 'properties', '.npmrc': 'properties', '.editorconfig': 'properties',
}

/**
 * Pick the editor language for a path.
 * @param path - file path with `/` or `\` separators.
 * @returns the matching language, or plain text.
 */
export function editorLanguageForPath(path: string): EditorLanguage {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1).toLowerCase()
  const dot = name.lastIndexOf('.')
  const id = BY_NAME[name]
    ?? (name.startsWith('dockerfile.') ? 'dockerfile' : undefined)
    ?? (dot > 0 ? BY_SUFFIX[name.slice(dot + 1)] : undefined)
    ?? 'plaintext'
  return editorLanguageById(id)
}

/**
 * Look a language up by id.
 * @param id - language id.
 * @returns the language, or plain text for an unknown id.
 */
export function editorLanguageById(id: string): EditorLanguage {
  return EDITOR_LANGUAGES.find(language => language.id === id) ?? PLAIN_TEXT
}
