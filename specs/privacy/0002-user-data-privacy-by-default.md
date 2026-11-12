# 0002 — User data privacy and anonymity by default

| Field | Value |
| --- | --- |
| Status | approved |
| Area | privacy (bundles, telemetry, session, llm) |
| Owner | henriqqw |
| Created | 2026-11-11 |
| Related | [public repository safety](../../docs/public-repository-safety.md), [spec 0001](../multimodal/0001-vision-browser-desktop.md) |

## Problem

The upstream defaults sent user data off the machine without an explicit user action:

- `session-log-deepseek` uploaded complete Session logs (up to 8 MiB per request) with every official DeepSeek API request, enabled by default.
- `session-telemetry-otel` exported the complete canonical Session prefix (message text, tool arguments and results, workspace paths) to a DeepSeek-controlled collector (`*.deepseeksvc.com`) whenever the user rated, edited, or wrote feedback, for every model provider.
- `host-product-telemetry-otel` and `client-product-analytics` exported product usage events from Desktop, with the account user id and device identity.
- `llm-deepseek` sent `x-another-harness-user-id`, a persistent installation UUID, on every DeepSeek request, linking all conversations of one installation.
- `plugin-package-inventory-deepseek` added the installed plugin names and versions to official DeepSeek requests.
- The support link prefilled the account UID, Harness version, OS, CPU, memory, and screen resolution into a third-party form.
- The plugin installer probed public npm registries in the background, and `web-fetch-http` named the product and repository in its `user-agent`.

AnotherHarness must be anonymous and private by default.

## Goals

- The shipped composition sends nothing off the machine except the requests the user directly causes: model calls to the providers the user configures, web search or fetch tools the agent runs, and provider account sign-in the user starts.
- No telemetry, analytics, or Session-log upload is mounted by any shipped bundle.
- No request carries a persistent installation identity, and no background network probe runs.
- Removed capabilities stay available as `optional` packages that an operator mounts explicitly.

## Non-goals

- Removing DeepSeek as a model provider or its account sign-in.
- Rewriting Session data already on disk.

## User-visible behavior

- Settings no longer shows the "Upload Session Log when using the official model API" switch.
- Rating or editing a message records the feedback in the local Session log only.
- Desktop sends no product analytics.
- The support link opens the configured page (default: the repository's GitHub issues) with no appended data.
- Pages fetched by web tools see the generic `user-agent` `Mozilla/5.0 (compatible)`.

## Acceptance criteria

- **AC-1** — Given the shipped `base` bundle, when its rows are composed, then it contains no `otel`, `session-telemetry-otel`, or `session-log-deepseek` row and does not depend on their packages.
- **AC-2** — Given the shipped `web-app` bundle, when its rows are composed, then it contains no `desktop-product-telemetry`, `product-analytics`, or `ui-settings-session-log` row and does not depend on their packages.
- **AC-3** — Given the shipped `sdk-minimal` bundle, when its rows are composed, then it contains no `session-log-deepseek` row.
- **AC-4** — Given `AH_TELEMETRY_DISABLED` is set and no telemetry row exists, when a profile boots, then boot succeeds without a disable patch.
- **AC-5** — Given an operator inserts the optional rows explicitly, when the profile boots, then the optional capability works as before.
- **AC-6** — Given any DeepSeek model request, when it is sent, then it has no `x-another-harness-user-id` header and no installation identity file is created.
- **AC-7** — Given the shipped bundles, when composed, then `plugin-package-inventory-deepseek` is not mounted and `ui-plugin-manager` has `registryProbeEnabled: false`.
- **AC-8** — Given a signed-in account and a Desktop device reader, when the user opens support, then the configured URL opens unchanged and the device reader is not called.

## Contracts

- `scripts/product-package-policy.ts` classifies `session-log-deepseek`, `ui-settings-session-log`, `otel`, `session-telemetry-otel`, `product-telemetry-otel`, `product-analytics`, and `plugin-package-inventory-deepseek` as `optional`.
- Session format: unchanged. The `session-log-deepseek/delivery-accepted` event type stays declared so existing logs remain readable.
- Configuration: the removed rows no longer exist; patches that target them must insert them first.

## Design

Rows are removed from the bundle patches and their dependencies from the bundle manifests. Every remaining consumer reads these services optionally (`ctx.get(...)?`), so no consumer changes are required. The launcher already skips the telemetry disable patch when the row is absent.

## Risks and mitigations

- A user profile patch that still targets a removed id fails at load → the upgrade note tells users to delete such entries.
- Feedback stops reaching the upstream maintainers → intended.

## Deferred

- Desktop packaging: the auto-updater feed and mandatory-update policy point at upstream infrastructure, and the native device-information IPC is now unused. AnotherHarness does not ship Desktop builds yet; a follow-up spec covers update channels before it does.
- The model-provider `user-agent` and the per-conversation Session id remain; neither identifies the user, and the Session id supports provider prompt caching.

## Rollout

Ships in the next commit on `main`; no migration.

## Implementation plan

1. Remove rows and dependencies from `base`, `sdk-minimal`, and `web-app`.
2. Classify the packages as `optional`.
3. Replace tests that asserted the shipped telemetry with privacy guards; make opt-in e2e scenarios insert the rows.
4. Update docs and the superseded Agent Note.

## Verification

| Criterion | Test | Verified |
| --- | --- | --- |
| AC-1 | `packages/bundle/base/tests/base.spec.ts` | ☑ |
| AC-2 | `packages/bundle/web-app/tests/privacy.spec.ts` | ☑ |
| AC-3 | `packages/bundle/sdk-minimal/tests/sdk-minimal.spec.ts` | ☑ |
| AC-4 | `apps/cli/tests/telemetry-switch.spec.ts` (`hasRow: false`) | ☑ |
| AC-5 | `apps/web/tests/session-log-upload.e2e.ts`, `apps/web/tests/feedback-release.e2e.ts` (web lane) | ☐ |
| AC-6 | `packages/llm/llm-deepseek/tests/runtime.spec.ts`, `loader-composition.spec.ts`, `dynamic-config.spec.ts` | ☑ |
| AC-7 | `packages/bundle/base/tests/base.spec.ts`, `packages/bundle/sdk-minimal/tests/sdk-minimal.spec.ts` | ☑ |
| AC-8 | `packages/client/ui-settings-account/tests/apply.client.spec.ts` | ☑ |
