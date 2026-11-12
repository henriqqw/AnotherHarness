# Privacy

English | [中文](privacy.zh.md)

This reference states what AnotherHarness sends off your machine. The shipped composition is anonymous and private by default: nothing leaves the machine unless you directly cause it, and no request carries a persistent identity for your installation. [Spec 0002](../specs/privacy/0002-user-data-privacy-by-default.md) records the requirements and their tests.

## What leaves the machine

Only the traffic you cause:

- **Model requests** to the providers you configure on the [Models page](user/guide/providers.md). Each request carries the conversation the model needs, the provider credential, an optional per-conversation Session id that providers can use for prompt caching, and a `user-agent` naming the application.
- **Web tools** the agent runs: search queries go to the configured search provider, and fetched pages see the generic `user-agent` `Mozilla/5.0 (compatible)`.
- **Provider account sign-in** that you start, such as DeepSeek Account, which contacts that provider's platform.
- **Opt-in capabilities** you enable yourself, such as [browser use and desktop use](user/guide/browser-and-desktop.md) or MCP servers.

## What never leaves the machine

- No telemetry, product analytics, or crash upload is mounted.
- Session logs, feedback, ratings, and edits stay in the local Session log.
- No persistent installation identifier is sent to any provider.
- The plugin installer does not probe package registries in the background.
- The support link opens the configured page without account, build, or device data.

## Optional capabilities for operators

The packages behind the removed behavior remain in the repository as `optional` packages that no shipped bundle mounts: `session-log-deepseek`, `session-telemetry-otel`, `otel`, `host-product-telemetry-otel`, `client-product-analytics`, and `plugin-package-inventory-deepseek`. An operator who wants them inserts their rows explicitly in a profile patch and points any collector at infrastructure they control.

## Data at rest

Sessions, attachments, credentials, and settings live under the Harness home (`~/.ah`). Credentials are stored with owner-only permissions. Nothing in the Harness home is uploaded by the shipped composition.
