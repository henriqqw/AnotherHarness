# 0003 — "Field Notes" visual language

| Field | Value |
| --- | --- |
| Status | implemented |
| Area | client |
| Owner | henriqqw |
| Created | 2026-11-12 |
| Related | [0001 brand identity](0001-anotherharness-brand-identity.md), [0002 plugin icons](0002-plugin-icon-style.md), owner-approved mockup "Field Notes" (2026-11-12) |

## Problem

Spec 0001 replaced the marks, palette accents and brand font, but the interface still reads as the upstream product. Three things cause that:

- **Neutrals:** surfaces, borders and secondary text come from the cool `--dsw-static-neutral-bluish-*` scale.
- **Weightless selection:** primary actions such as New session are grey slabs, and selection is a faint grey fill.
- **Typography:** all UI text uses the system font, with one flat weight hierarchy.

The owner asked for an identity of our own that is creative but restrained: no generic AI effects such as glow, neon, gradients or blur.

## Goals

- **Warm neutrals:** replace the cool neutrals with a warm olive-black dark material and a Warm Ivory paper light material.
- **Restrained lime:** spend flat lime (dark) or Deep Forest (light) only on the primary action and on the square marker.
- **Square marker:** use the brand kit's square "pixel" as the UI's marker for active, open, selected and status states.
- **Editorial type:** use Plus Jakarta Sans for UI text, heavier headlines, and monospaced uppercase labels for section headers, times, IDs and status.
- **Selection in ink:** mark selected cards and options with a 2px border in the text colour, not tinted glows.

## Non-goals

- **No effects:** no glow, coloured shadows, gradients, blur, backdrop filters or decorative animation anywhere this spec touches.
- **No layout restructure:** components keep their structure and behaviour. The work is restyling plus the hero copy split below.
- **Later specs:** the chat transcript, markdown, code blocks, diff colours, the Desktop welcome window and installer pages are deferred.
- **macOS vibrancy:** the macOS sidebar vibrancy treatment stays as it is.
- **Plugin icons:** they stay as redrawn in 0002.

## User-visible behavior

**Dark material**
- Page `#121311`, sidebar rail `#0E0F0D`, raised surfaces `#1A1B19`, sunk wells `#0B0C0A`.
- Hairlines `#2A2B27` / `#3A3B36`; text ivory `#F1F0E8`, secondary `#B9B8AE`, tertiary `#7D7D74`.

**Light material**
- Page Warm Ivory `#F1F0E8`, rail `#E8E7DD`, raised `#FAF9F3`, sunk `#E2E1D6`.
- Hairlines `#D6D5C9` / `#C4C3B6`; ink `#15201A`, secondary `#4C524B`, tertiary `#7E8279`.

**Accent and marker**
- Dark: the accent is Primary Lime with Obsidian text, and the marker is lime.
- Light: the accent is Deep Forest with ivory text, and the marker is the brand gradient's green `#3DBE3A`. Text links stay on the leaf green from 0001.
- The marker is a 6–8px square. It shows:
  - after the active navigation item;
  - before an open workspace, filled (closed workspaces show an outline square);
  - before a status;
  - inside the selected appearance option.
- The current session gets a 2px marker-coloured rule on its left.

**Sidebar**
- New session is a flat accent-filled button with its shortcut in mono.
- Section labels such as WORKSPACES are mono, uppercase and letter-spaced.
- Session times are mono.
- Session titles use the secondary ink and the current session the primary ink.

**Empty-conversation hero**
- The hero is a left-aligned editorial block inside the composer column: the 92px mascot beside a mono "Session draft" eyebrow, then a two-line 40px/800 headline.
- The headline reads "Modular intelligence" with "for AI agents." on the second line in tertiary ink.
- Under the headline, a mono line lists "agents — plugins — workflows — and more". It sits in the hero block because the composer is mounted outside the hero.
- The Preview badge becomes a mono uppercase tag beside the eyebrow.

**Settings**
- The dialog title is 22px/800.
- Group labels are mono uppercase.
- Selected appearance and agent-preset cards show a 2px text-coloured border, and the default preset's pill uses the accent fill.
- Model-provider status is a square marker: filled when a key is set, an outline square in the error colour when no key is set. The "Custom" tag is mono uppercase.
- Provider rows form one table separated by 0.5px hairlines instead of filled cards. Hairlines stay 0.5px, as the repository's border rule requires.

**Typography**
- UI text uses Plus Jakarta Sans, with the system stack as fallback for scripts outside its Latin subset (Chinese keeps PingFang/YaHei).
- A user-chosen font in Settings still wins.

## Acceptance criteria

- **AC-1** — Given the theme sheet, when it is parsed, then every `--dsw-static-neutral-bluish-*` step except `-00` (pure white) and `-1000` (pure black) has a warm hue (red ≥ blue and green ≥ blue).
- **AC-2** — Given dark mode, then `--dsw-alias-bg-base` is `#121311`, the sidebar fill is `#0E0F0D` and `--dsw-alias-bg-layer-1` is `#1A1B19`. Given light mode, then `--dsw-alias-bg-base` is `#F1F0E8` and the raised layer is `#FAF9F3`. The pre-paint boot backgrounds match both values.
- **AC-3** — Given both modes, then label-primary and label-secondary on the page reach at least 4.5:1 and label-tertiary at least 3:1, and the accent text on the accent fill reaches at least 4.5:1.
- **AC-4** — Given the theme defaults, then `--ah-font-family-text-default` starts with `'Plus Jakarta Sans'` and keeps the CJK system families, and a user text font set in Settings still leads the resolved stack.
- **AC-5** — Given the sidebar, then New session uses the primary-button fill and label, the active navigation item and the open workspace render the square marker, the current session renders the marker rule, and section labels use the code font in uppercase.
- **AC-6** — Given an empty conversation, then the hero renders the eyebrow, both headline lines from locale keys (en and zh), the mono capability line, and the mascot slot at 92px.
- **AC-7** — Given Settings, then selected appearance and preset cards use a 2px `--dsw-alias-label-primary` border, and model-provider status renders the square marker.
- **AC-8** — Given the stylesheets this spec changes, when they are scanned, then their added rules contain no `gradient(`, `blur(`, `backdrop-filter`, or coloured `box-shadow`.

## Contracts

- **New theme aliases:**
  - `--dsw-alias-brand-marker`: marker colour.
  - `--dsw-alias-bg-rail`: sidebar and settings navigation fill.
  - `--dsw-alias-bg-sunk`: wells.
  - `--dsw-alias-border-hair` and `--dsw-alias-border-hair-strong`: hairlines.
- **Remapped tokens:** existing aliases keep their names but resolve to the new materials, and the cool neutral static scale is remapped to warm values under the same names. No consumer renames.
- **New locale keys** in `ui-conversation`, en and zh: `hero.eyebrow`, `hero.headlineAccent` and `hero.capabilities`. `hero.headline` becomes the first headline line.
- **Unchanged:** slots, props and settings stay as they are, there is no session-log impact, and there are no configuration fields.

## Design

- **Tokens (`ui-theme`):**
  - Remap the neutral-bluish scale to warm steps of equal lightness, so the 130 existing uses shift together.
  - Point the page, layer, rail, sunk, border, sidebar and nav aliases at the materials above.
  - Define the marker alias.
  - Set light `--dsw-alias-button-primary-fill` to Deep Forest with ivory foreground.
  - Update the boot backgrounds in `boot-theme.ts` and `packages/client/web`.
- **Typography (`ui-theme/base.css`):** put `'Plus Jakarta Sans'` at the head of the text default stack. Add weights 600 and 800 to the bundled faces (Latin, OFL), because the headline uses 800 and labels use 600.
- **Sidebar (`ui-sidebar`):** restyle `.newSession`, the active nav item, the workspace and session rows and the section labels in `SidebarRoot.module.css` (CSS-only, through aliases), plus the marker element where a pseudo-element cannot reach.
- **Hero (`ui-conversation`):** restructure `HeroShell` markup into the editorial block, add the new locale keys and restyle `HeroShell.module.css`. The composer itself is untouched.
- **Settings:**
  - Restyle the dialog shell title and group labels where they live (`ui-settings`, `ui-settings-general`).
  - Restyle the appearance cards and agent-preset cards (`ui-agent-preset`).
  - Restyle the model-provider rows (`ui-settings-models/ModelsSection.module.css`) and the built-in plugin cards (`ui-settings-plugin-inventory`) to hairline rows and ink selection.
- **Alternatives considered:** the first mockup, "Abyssal", used glow, gradients, a grid backdrop and floating pixels. The owner rejected it as generic AI styling.

## Risks and mitigations

- **Warm neutrals shift every surface at once.** Mitigation: equal-lightness remapping, the AC-3 contrast test, and a review of each touched screen in the dev server in both modes before commit.
- **Snapshot churn.** Mitigation: snapshot and expected-text updates go in the same commit and may differ only in class or structure for the touched components.
- **Bundling two more font weights.** Mitigation: Latin subset only, about 12 KB each.

## Rollout

No flag; the change ships with the next build. There is no upgrade-guide entry: users' chosen fonts and themes keep working.

## Implementation plan

1. Tokens, the warm scale, boot colours and the font stack and weights, with the AC-1 to AC-4 tests.
2. Sidebar restyle (AC-5).
3. Hero restructure and locale keys (AC-6).
4. Settings surfaces (AC-7).
5. The effects scan test (AC-8), a dev-server review in dark and light, focused tests, snapshots, `typecheck`, `lint` and `test:docs`.
6. Commit on `frontend` and push.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `packages/client/ui-theme/tests/brand-palette.client.spec.ts` | ☑ |
| AC-2 | `packages/client/ui-theme/tests/brand-palette.client.spec.ts`, `packages/client/ui-theme/tests/boot-theme.client.spec.ts` | ☑ |
| AC-3 | `packages/client/ui-theme/tests/brand-palette.client.spec.ts` | ☑ |
| AC-4 | `packages/client/ui-theme/tests/brand-font.client.spec.ts` | ☑ |
| AC-5 | `apps/web/tests/field-notes-styles.spec.ts`, `packages/client/ui-sidebar/tests`, `packages/client/ui-workspace/tests` | ☑ |
| AC-6 | `packages/client/ui-conversation/tests/skeleton.client.spec.tsx` | ☑ |
| AC-7 | `apps/web/tests/field-notes-styles.spec.ts`, `packages/client/ui-settings-models/tests/styles.client.spec.ts` | ☑ |
| AC-8 | `apps/web/tests/field-notes-styles.spec.ts` | ☑ |

The material tests extend the 0001 palette test so the stylesheet parser exists once. The cross-package style checks live with the Web tests, because the test globs do not collect a group-level directory. Dark mode was reviewed in the dev server (sidebar, hero, Settings General and Models). Light mode is covered by the contrast and material tests, because the owner's saved theme is dark. The recorded Web snapshots for the hero were updated by hand and were not replayed locally, because Playwright Chromium is missing from the development environment.
