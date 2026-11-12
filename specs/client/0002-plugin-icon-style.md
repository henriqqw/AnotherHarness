# 0002 — Consistent plugin icon style

| Field | Value |
| --- | --- |
| Status | implemented |
| Area | client |
| Owner | henriqqw |
| Created | 2026-11-12 |
| Related | [0001 brand identity](0001-anotherharness-brand-identity.md) |

## Problem

The plugin list (Plugins page and Settings → Experimental) shows each plugin's `icon.svg`, and the icons use two different drawing styles. Most icons are compact filled glyphs on a 36-unit canvas, with a blue gradient body and white or bold details: Voice input, Auto Authorization Review, Developer Tools, Agent Teams, Ralph loops, Codex and Claude Code. Six icons do not match them:

- Git Worktrees (`packages/experimental/tool-worktree/icon.svg`)
- Machine translation of reasoning (`packages/experimental/cot-translation-bundle/icon.svg`)
- Persistent terminals (`packages/experimental/terminal-bundle/icon.svg`)
- Session search (`packages/experimental/session-search/icon.svg`)
- Conversation-following titles (`packages/experimental/session-titles-bundle/icon.svg`)
- AH badge skill (`packages/experimental/badge-skill-bundle/icon.svg`)

Five of them draw a 16-unit glyph stretched to 36 px with 1–1.3-unit strokes in one flat blue. The result fills the whole tile with thin lines, so they look larger, lighter and flatter than their neighbours. Persistent terminals keeps the 36-unit grid but is a flat `#679EFE` stroke with no gradient body.

## Goals

- Redraw the six icons in the style of the reference set, keeping each icon's current motif:
  - Git Worktrees: a branch fork.
  - Machine translation: an orbit or atom.
  - Persistent terminals: a prompt chevron and cursor.
  - Session search: a magnifier.
  - Conversation-following titles: a chat bubble with a plus.
  - AH badge skill: a check badge.

## Non-goals

- No change to the reference icons, to plugin artwork in `ui-primitives`, or to the skill templates in `packages/preset/agent-preset`.
- No recolouring of the plugin icons to the brand lime. The reference set's blue gradients stay, since the request is consistency with them.
- No change to how the plugin list loads or renders icons.

## User-visible behavior

All plugin rows show icons of the same visual weight: a filled gradient glyph of about 22 px centred in the 36 px tile, with white or bold inner details, in light and dark mode.

## Acceptance criteria

- **AC-1** — Given each of the six redrawn `icon.svg` files, when it is parsed, then its `viewBox` is `0 0 36 36`, its shapes stay within the 6–30 unit box, and it carries no root `stroke-width` attribute.
- **AC-2** — Given each redrawn icon, when it is parsed, then its main body is filled with a `linearGradient` whose two stops use the reference palette (`#67C7FE`/`#7AC2FF` to `#3F77D8`/`#4A65E8`), and every stroke it keeps is at least 1.8 units wide.
- **AC-3** — Given the Plugins page, when the six plugins render beside the reference plugins, then a visual check in the browser pane shows matching size and weight. The check is recorded in the verification table.

## Contracts

- File contents only. Paths, package `icon` fields and plugin metadata are unchanged.
- No configuration fields and no session-log impact.

## Design

- Draw each glyph by hand on the 36-unit grid, following the reference geometry. For example, the Auto Review shield body spans 7.5–28.5 units, and the Voice input bars span 7.5–28.5 units.
- Fill the main body with the gradient. Draw secondary details in `#FFFFFF`, or with a ≥1.8-unit stroke in `#145AF3`, as Developer Tools does.
- Each file defines its own gradient id, because the browser may inline several icons into one document.
- A new test `apps/web/tests/plugin-icon-style.spec.ts` asserts AC-1 and AC-2 over the six files; it lives with the Web tests because the repository test globs do not collect a group-level `packages/experimental/tests` directory.

## Risks and mitigations

- **Plugin manager tests may embed icon bytes as data URIs.** Mitigation: update any affected expectations in the same commit.
- **A hand-drawn glyph can read poorly at 36 px.** Mitigation: review each glyph in the running dev server before committing.

## Rollout

No flag; the icons ship with the next build. No upgrade-guide entry.

## Implementation plan

1. Redraw the six SVGs.
2. Add the style test.
3. Review the Plugins page in the dev server.
4. Run the focused tests, lint and `test:docs`.
5. Commit on `frontend` and push.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `apps/web/tests/plugin-icon-style.spec.ts` | ☑ |
| AC-2 | `apps/web/tests/plugin-icon-style.spec.ts` | ☑ |
| AC-3 | Browser-pane review of the Plugins page and the Experimental plugins list (dark mode) | ☑ |
