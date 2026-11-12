# 0001 — Vision, browser use, and desktop use for agents

| Field | Value |
| --- | --- |
| Status | draft |
| Area | multimodal (attachment, llm, browser-use, computer-use) |
| Owner | henriqqw |
| Created | 2026-11-11 |
| Related | [attachment subsystem](../../docs/subsystems/attachment.md), [browser use](../../docs/subsystems/browser-use.md), [computer use](../../docs/subsystems/computer-use.md) |

## Problem

Agents must be able to receive images from the user and interpret them, operate a web browser, and observe and operate desktop applications and windows. The capability seams for all three exist, but out of the box only part of it works:

- **Images.** Durable image attachments are on by default (`ah-attachment-local`, `ah-client-ui-attachment`, `ah-compaction-image-offload`). Only `deepseek-flash` (DeepSeek-V4.1-Flash) declares `inputModalities: ['text', 'image']`; `deepseek-v4-pro` is text-only, and the session controller rejects image input for it. A user on V4-Pro cannot use images at all.
- **Browser use.** `ah-browser-use` only registers one provider; every provider (Playwright MCP, Chrome DevTools MCP, Stagehand) is an `experimental` package that no shipped profile mounts. No Chromium is provisioned. The Web/Desktop right-sidebar browser is a human-facing panel, not an agent tool.
- **Desktop use.** `ah-computer-use` only registers one provider; both Cua Driver providers are `experimental` and unmounted. Under WSL the host sees the WSLg Linux desktop, not Windows applications.

## Goals

- A user can attach an image with any selected DeepSeek model and the agent answers about its content.
- A user can enable browser use with one documented setting; the agent can open, read, and operate web pages and receive screenshots.
- A user can enable desktop use; the agent can list windows, read their content (screenshots and accessibility text where the driver provides it), and act on them.
- Tool screenshots flow into the same durable attachment pipeline as user images.

## Non-goals

- Bundling a browser or desktop driver into the default install.
- Restoring browser login state across Sessions (the browser-use contract starts fresh state per Session).
- Video or audio input.

## User-visible behavior

- **Images:** attaching an image with an image-capable model sends it as-is. With a text-only model, the harness first asks the configured vision model to describe the image, shows that the description was used, and sends the description to the selected model.
- **Browser:** `ah setup browser` (or a Settings toggle) installs Chromium for Playwright and writes a profile patch that mounts `ah-browser-use` with the Playwright MCP provider in `launch` mode, headless by default; an `attach` mode connects to an existing Chrome debugging endpoint.
- **Desktop:** `ah setup desktop` checks the platform, installs or locates Cua Driver, verifies permissions without prompting, and writes the profile patch. On WSL it warns that only the Linux (WSLg) desktop is reachable and points to running AnotherHarness natively on Windows for Windows applications.

## Acceptance criteria

- **AC-1** — Given `deepseek-flash` is selected, when the user attaches a PNG and asks what it shows, then the request carries the image and the answer references its content.
- **AC-2** — Given `deepseek-v4-pro` is selected and a vision model is configured, when the user attaches an image, then a vision-description Session event is recorded and the text-only request contains that description instead of rejecting the input.
- **AC-3** — Given no vision model is configured and a text-only model is selected, when the user attaches an image, then the input is rejected with an actionable message that names the setting to change.
- **AC-4** — Given browser use is enabled, when a new Session asks to open `https://example.com` and report the heading, then the agent uses browser tools and the result contains the page heading.
- **AC-5** — Given browser use is enabled, when a browser tool returns a screenshot and the model accepts images, then the screenshot is stored as a durable attachment and shown in history.
- **AC-6** — Given desktop use is enabled on a supported platform, when the agent lists windows, then the result names the open application windows.
- **AC-7** — Given the host runs under WSL, when desktop use setup runs, then it reports that Windows applications are not reachable from WSL.
- **AC-8** — Given neither capability is enabled, when a Session starts, then no browser or desktop tools are offered and startup cost is unchanged.

## Contracts

- **Session log:** a new ignorable event recording the vision description (source attachment id, vision model id, description text), because model-visible input must be reconstructable from the log.
- **Configuration:** `llm-deepseek` (or a new `ah-vision-bridge` package) gains `visionModel` (model id, optional). Setup commands write user-layer profile patches; no shipped default changes.
- **Packaging:** promoting a provider out of `experimental` is a product decision governed by `verify-default-product-isolation`; this spec keeps providers opt-in.

## Design

- **Vision bridge** as its own package behind a seam: it hooks request assembly before the provider call, only for image parts sent to a model whose catalog entry lacks `image`. It calls the configured vision model, emits the Session event, and replaces the image part with text. Consumers do not change.
- **Setup commands** live in the CLI and reuse the existing profile patch layering; they never edit shipped bundles.
- **Screenshots** already reach image-capable routes through the attachment store; AC-5 only adds coverage.

## Risks and mitigations

- Vision descriptions lose detail → show the description to the user and keep the original attachment for image-capable models in later turns.
- Extra cost and latency per image → only for text-only routes, with token accounting already present in `image-tokens.ts`.
- Desktop control is powerful → keep it opt-in, require explicit enablement per profile, and rely on the existing approval policy for tool calls.
- Experimental providers can change upstream → pin versions as the packages already do.

## Rollout

Opt-in through setup commands and Settings; documented in the user guide. No breaking change; no upgrade-guide entry.

## Open questions (block approval)

1. Vision bridge model: `deepseek-flash` by default, or another provider routed through `llm-pi-ai`?
2. Browser provider default: Playwright MCP (recommended: maintained, headless, attach mode) or Chrome DevTools MCP?
3. Desktop target: run AnotherHarness natively on Windows to reach Windows applications, or accept the WSLg Linux desktop only?
4. Keep browser and desktop use opt-in (recommended), or promote them into the shipped `web` profile?

## Implementation plan

1. Vision bridge package, Session event, config field, tests for AC-2 and AC-3.
2. AC-1 regression test against the replay harness.
3. `ah setup browser` and Playwright Chromium provisioning; tests for AC-4, AC-5, AC-8.
4. `ah setup desktop` with platform and WSL detection; tests for AC-6 and AC-7.
5. User guide pages (EN/ZH) and Settings toggles.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | — | ☐ |
| AC-2 | — | ☐ |
| AC-3 | — | ☐ |
| AC-4 | — | ☐ |
| AC-5 | — | ☐ |
| AC-6 | — | ☐ |
| AC-7 | — | ☐ |
| AC-8 | — | ☐ |
