# 0001 — AnotherHarness brand identity in the Web UI and Desktop

| Field | Value |
| --- | --- |
| Status | approved |
| Area | client |
| Owner | henriqqw |
| Created | 2026-11-11 |
| Related | Brand kit supplied by the owner (mascot, banner, palette, typography) |

## Problem

The code and package names are already AnotherHarness, but the interface still looks like the
upstream product. The sidebar, empty-conversation hero, favicon, Desktop icons and welcome screen
all draw the DeepSeek whale, and the official wordmark spells "deepseek HARNESS". The accent colour
is DeepSeek blue and the brand font is Montserrat. A user who opens AnotherHarness sees another
product's identity, and the public repository ships artwork that is not ours.

## Goals

- Replace every whale mark and the "deepseek" wordmark in the Web UI and Desktop with the
  AnotherHarness jellyfish mascot and an "AnotherHarness" wordmark ("Another" in ivory or ink,
  "Harness" in lime).
- Retarget the theme's brand and accent tokens to the brand palette, in light and dark mode,
  without breaking text contrast.
- Replace Montserrat with Plus Jakarta Sans (OFL), bundled locally.
- Replace favicons, the PWA manifest icon, Desktop app, tray and installer icons, and the Desktop
  welcome artwork.
- Replace upstream slogan copy ("Into the Unknown", "Build potential. Explore intelligence.") with
  the AnotherHarness tagline.

## Non-goals

- DeepSeek as a **model provider** stays: "DeepSeek Account", `llm-deepseek`, the DeepSeek search
  provider, "Signed in to DeepSeek" and similar provider strings are untouched.
- No layout, navigation or component redesign. Only identity: marks, colours, font, copy.
- The marketing site (`website/`) and the README banner are out of scope.
- Onboarding illustrations in `ui-settings-account/src/client/assets/` are only replaced if they show
  the old brand. Otherwise they stay as they are.
- No user-facing setting to choose a brand. Branding is the product's own.

## User-visible behavior

- **Web, any build:** the browser tab shows the jellyfish favicon on light and dark tab bars.
- **Sidebar:** shows the jellyfish mark next to "AnotherHarness" in official builds, and next to
  "AH Local Build" in local builds. The local-build fallback stays so builds can be told apart.
- **Empty conversation:** shows a 40px jellyfish that bobs while hovered, instead of the whale swim.
  It keeps the reduced-motion behaviour. The headline reads "Modular Intelligence for AI Agents".
- **Running indicator:** the whale-tail animation in the chat becomes a vector jellyfish whose bell
  pulses and tentacles sway, in the same size and position.
- **Primary buttons, links, active nav items, focus rings and selection accents use the brand palette:**
  - Dark mode: Primary Lime `#B8F34A` fills with Obsidian `#111214` text. Lime links and accents.
    Background Obsidian, raised surfaces Graphite `#202124`, secondary text Slate `#777E83`.
  - Light mode: the background stays white. Primary buttons are Deep Forest `#183D2B` with white
    text. Links, the focus ring, info buttons and the "Harness" half of the wordmark use a leaf
    green `#237A2A` (5.4:1 on white), derived from the brand gradient, because lime on white fails
    contrast and Deep Forest links are hard to tell apart from body text. Lime tints fill the user
    bubble and the active navigation accent; lime itself is never light-mode text.
  - Soft Mint `#76DDB7` is part of the palette scale for later secondary accents.
- **Fonts:** the brand font (wordmark, onboarding and welcome headings) is Plus Jakarta Sans. Body
  text keeps the system stack, and code keeps the existing monospace stack.
- **Desktop:** the app, taskbar or dock icon, tray icon, NSIS installer art and welcome screen show
  the jellyfish and the AnotherHarness wordmark.

## Acceptance criteria

- **AC-1** — Given any build, when the Web UI loads, then `index.html` links light and dark jellyfish
  favicons and the manifest icons are jellyfish PNGs (192 and 512 px). No whale path remains in
  `apps/web/public`.
- **AC-2** — Given the official profile, when the sidebar renders, then the brand mark is the
  jellyfish and the brand name is the "AnotherHarness" wordmark. Given a local build, the mark is the
  jellyfish and the name is "AH Local Build".
- **AC-3** — Given an empty conversation, when the hero renders, then it shows the jellyfish mark and
  the localized tagline (en and zh). With `prefers-reduced-motion`, it does not animate.
- **AC-4** — Given a running turn, when the chat shows the running indicator, then it renders the
  jellyfish indicator asset and no whale asset is emitted by `ui-chat`.
- **AC-5** — Given dark mode, when the theme sheet applies, then `--dsw-alias-button-primary-fill`
  resolves to `#B8F34A`, the page background to `#111214`, and the pre-paint boot background matches
  (`#111214`), so there is no flash of the old colour.
- **AC-6** — Given light mode, when the theme sheet applies, then the primary button fill is
  `#183D2B` and the link colour is `#237A2A`. Every brand text and background pair touched by this
  spec meets WCAG AA (4.5:1). A test computes the ratios from the token values.
- **AC-7** — Given the Web and Desktop welcome builds, when the brand font loads, then
  `--dsw-font-family-brand` starts with `'Plus Jakarta Sans'`, the woff2 files and
  `PlusJakartaSans-OFL.txt` are emitted locally, and no Montserrat file is shipped.
- **AC-8** — Given a Desktop build, when it packages, then the app icon, macOS icon, tray icon,
  installer images and `welcome-brand.svg` are the new artwork. `ah://app` serves every public icon
  that `index.html` and the manifest reference.
- **AC-9** — Given the client UI sources (excluding provider integrations and locale strings that name
  DeepSeek as a provider), when `verify` scans them, then no `FishLogo`, whale component or
  "deepseek" wordmark art remains.

## Contracts

- **Slots are unchanged:** `sidebar.brand.mark`, `sidebar.brand.name` and
  `conversation.hero.brand.mark` keep their names and contracts.
- **`ui-primitives`:** `FishLogo`, `FISH_LOGO_PATH` and `FISH_LOGO_VIEWBOX` are replaced by
  `BrandMark` (jellyfish, `size` is the height) and `BRAND_MARK_ASPECT`. `BrandWordmark` keeps its
  name and props and renders the new wordmark. The owner approved removing the `FishLogo` exports
  with this spec; all callers are internal.
- **Theme tokens:** new `--dsw-static-brand-*` scale and `--dsw-alias-brand-accent-text` alias. The
  blue `--dsw-static-deepseek-*` scale is renamed `--dsw-static-azure-*` with unchanged values.
- **Static pipeline:** `packages/host/frontend-static` gains MIME types for `.png`, `.ico`, `.woff2`
  and `.webp`.
- **Configuration and session log:** no new configuration fields and no session-log impact.

## Design

**Assets**
- The owner supplied raster renders of the mascot (on white and on black), not vector masters.
- Implementation extracts a transparent master from the black-background render. It flood-fills the
  outer background, keeps the enclosed pupils, and uses an anti-aliased alpha edge.
- From that master `apps/desktop/scripts/render-brand-assets.ts` (`pnpm run render:brand-assets` in
  `apps/desktop`) generates the Desktop icon SVGs and PNGs (the jellyfish on an Obsidian tile with a
  lime glow), `tray-windows.ico` through the existing tray renderer, the installer images, the
  welcome wordmark, the Web favicons (SVG and a 16/32/48 px ICO), the 180, 192 and 512 px icons, and
  the `ui-primitives` artwork module. The source render lives in `apps/desktop/resources/brand/`
  beside the existing icon sources, and the generator reuses the Desktop `sharp` dependency.
- The wordmark is outlined from Plus Jakarta Sans Bold with `fontkit` (a new Desktop
  devDependency), so no output depends on an installed font. Mono and outline variants are out of
  scope until vector masters are supplied.
- In-app marks (`BrandMark`) use an inline SVG that embeds the optimized PNG as a data URI. This keeps
  the existing inline, slot-based rendering without a network request. When a vector master
  arrives, only this file changes.

**Theme (`ui-theme`)**
- In `design-platform.css`, add a `--dsw-static-brand-*` scale (lime, electric lime, forest, mint,
  ivory, graphite, obsidian, slate).
- Repoint the brand, button-primary, link, business-state, focus, bubble and active-nav aliases to it
  per mode, as described in "User-visible behavior".
- Retarget the dark neutral background and surface aliases to Obsidian and Graphite.
- Only two feature stylesheets still named the blue scale directly. File-type artwork keeps its blue
  through the renamed `--dsw-static-azure-*` scale; the always-dark toast action uses brand lime.
- `boot-theme.ts` and `packages/client/web` boot fallbacks use `#111214` for dark.

**Font**
- `brand-font.css` declares Plus Jakarta Sans 300, 400, 500 and 700 (woff2, OFL, Latin subset); 300
  replaces the Montserrat Light that onboarding and the welcome window use.
- The Vite `brandFontLicense` plugin and the Desktop `tsdown` copy step emit the new files and licence.

**Copy:** update locale dictionaries (en and zh) for the hero headline, the Desktop welcome
description and the API-key welcome text. The API-key form saves a DeepSeek key, so that text keeps
naming DeepSeek and only replaces "Harness" with "AnotherHarness".

**Alternatives considered**
- Hand-redrawing the mascot as SVG now: better scaling, but a redraw risks drifting from the owner's
  art. Deferred to when a vector master exists.
- A separate brand package replacing `ui-brand-official`: unnecessary, since the slots already exist
  and the official package is ours to change.

## Risks and mitigations

- **Raster extraction leaves halo pixels at small sizes.** Mitigation: the favicon sizes are
  downscaled from 1024 px with a sharpen pass, and reviewed visually in the browser pane before
  commit.
- **Lime has low contrast on white.** Mitigation: lime is never used as light-mode text, and AC-6
  test enforces ratios.
- **Many snapshot and expected-text tests change.** Mitigation: update them in the same commit. Only
  brand diffs are allowed in snapshot changes.
- **Parallel work in `ui-conversation/src/client/locales.ts`.** Mitigation: the hero copy edit waits
  until the multimodal spec commit lands and `frontend` is rebased.

## Rollout

- No flag. The change ships with the next build.
- No upgrade-guide entry: the change is visual, and no API or config breaks for users.
- `FishLogo` removal is internal to the workspace.

## Implementation plan

1. Asset generator and transparent master, with generated icons. Visual review in the browser pane.
2. `BrandMark` and new `BrandWordmark` in `ui-primitives`. Wire them into the sidebar, hero and
   `ui-brand-official`.
3. Running indicator asset in `ui-chat`.
4. Theme tokens, boot colours and the feature CSS migration off `--dsw-static-deepseek-*`.
5. Plus Jakarta Sans font swap (Web and Desktop welcome).
6. Favicons, manifest, `frontend-static` MIME types, the Desktop allowlist and icons, installer art and
   welcome SVG.
7. Copy changes, after the rebase on the multimodal commit.
8. Update tests and snapshots. Run focused tests, `typecheck`, `lint`, `test:docs`, and the
   `test:web` snapshot replay.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `apps/web/tests/pwa-manifest.e2e.ts` | ☐ |
| AC-2 | `packages/client/ui-sidebar/tests/sidebar-snapshot.client.spec.tsx`, `packages/client/ui-brand-official/tests/browser-plugin.client.spec.tsx` | ☑ |
| AC-3 | `packages/client/ui-conversation/tests/skeleton.client.spec.tsx` | ☐ |
| AC-4 | `packages/client/ui-chat/tests/running-jellyfish.client.spec.tsx`, `apps/web/tests/reasoning-preview.e2e.ts` | ☐ |
| AC-5 | `packages/client/ui-theme/tests/brand-palette.client.spec.ts`, `packages/client/ui-theme/tests/boot-theme.client.spec.ts` | ☑ |
| AC-6 | `packages/client/ui-theme/tests/brand-palette.client.spec.ts` | ☑ |
| AC-7 | `packages/client/ui-theme/tests/brand-font.client.spec.ts`, `apps/web/tests/desktop-onboarding.e2e.ts` | ☐ |
| AC-8 | `apps/desktop/tests/tray-icon.spec.ts`, `apps/desktop/tests/installer-packaging.spec.ts`, `apps/desktop/tests/welcome-renderer.client.spec.tsx` | ☑ |
| AC-9 | `packages/client/ui-primitives/tests/icons.client.spec.tsx` | ☑ |
