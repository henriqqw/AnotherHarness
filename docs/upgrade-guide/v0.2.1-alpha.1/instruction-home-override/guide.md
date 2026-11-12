---
kind: upgrade-guide
description: "The `agent-instructions` row no longer accepts `ahHome`; instruction loading always resolves the harness home from `$AH_HOME` or `~/.ah`."
---

# Instruction loading resolves one harness home

English | [中文](guide.zh.md)

## Change

`@anotherharness/ah-agent-instructions` removed its `ahHome` config field. The plugin resolves the harness home through `resolveAhHome()` from `@anotherharness/ah-home-paths`, like every other harness consumer: the home is `$AH_HOME` when it is set and non-blank, otherwise `~/.ah`, with tilde expansion.

A `cordis.yml`, profile patch, or `--patch` overlay that still sets `ahHome` on the `agent-instructions` row has no effect: the row keeps the stray key and the plugin ignores it, so instruction loading follows the process home. Other providers, such as `ah-skill-filesystem` and `ah-shell-env`, keep their own home fields; this removal covers the instruction loader only.

## Migration

1. Delete `ahHome` from the `agent-instructions` row in `cordis.yml`, `$AH_HOME/cordis.patch.yml`, `$AH_HOME/profiles/<profile>/cordis.patch.yml`, and any `--patch` overlay.
2. Where the override pointed at a non-default home, export `AH_HOME` for the process instead, so every harness consumer reads that home.
3. Confirm with `ah --profile <profile> --dump-config` that the `agent-instructions` row lists only its remaining fields, and that a new session's first request shows `Instructions from: $AH_HOME/AGENTS.md` (or `~/.ah/AGENTS.md`) when that file exists.
