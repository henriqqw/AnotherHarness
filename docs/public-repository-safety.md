# Public repository safety

English | [中文](public-repository-safety.zh.md)

This reference defines what may never enter the public AnotherHarness repository and the checks that keep it out. Everything committed, pushed, or written into an issue, pull request, commit message, or CI log is world-readable and permanent: a deleted line remains in Git history, forks, and caches.

## Never publish

- **Secrets:** API keys for any provider, tokens (including GitHub `ghp_`, `gho_`, and `github_pat_` tokens), passwords, OAuth client secrets, cookies, session identifiers, private keys and certificates, signing material, webhook URLs that carry tokens, and connection strings with credentials.
- **Identifiers from real machines or accounts:** account, user, organization, tenant, and project IDs; machine names; IP and MAC addresses; hardware serials; device IDs; and telemetry or anonymous-identity IDs.
- **Personal and user data:** real names, email addresses, usernames, home-directory paths, phone numbers, postal addresses, chat transcripts, recorded sessions, and screenshots or recordings that show any of these.
- **Private projects:** code, file names, paths, hostnames, findings, targets, and client data from other repositories, engagements (including security testing), or private work.
- **Local environment data:** the contents of `.env`, MCP configuration with real credentials, the Harness home, settings and credential stores, shell history, and crash dumps.

## Required practice

1. Use placeholders only: `DEEPSEEK_API_KEY` from the environment, `<your-api-key>`, `example.com`, `user@example.com`, `/home/user`, and `C:\Users\user`. Test keys are visibly fake, such as `sk-test-0000`.
2. Keep secrets outside Git: in the gitignored root `.env`, in environment variables, or in the operating-system keychain. Commit only `*.example` files with placeholder values.
3. Before every commit and push, inspect each added line of `git diff --cached` and search it for key patterns (`sk-`, `ghp_`, `gho_`, `github_pat_`, `AKIA`, `PRIVATE KEY`, `password`, `token`, `secret`), home-directory paths, and real usernames.
4. Scrub keys, paths, usernames, and private content from recorded sessions and snapshots before committing them.
5. Keep private notes, plans, and research in the gitignored `.private/` directory, never in `docs/`.
6. When unsure, leave the content out and ask the maintainer.

## When a secret leaks

Stop and tell the maintainer immediately. Treat the secret as compromised: revoke and rotate it, because removing it from Git does not undo the exposure. History rewriting is the maintainer's decision, never an agent's.
