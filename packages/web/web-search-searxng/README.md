---
description: "Self-hosted SearXNG search provider for the AnotherHarness web capability seam (ctx.web) — no API key, aggregates Google, Bing, DuckDuckGo, GitHub, arXiv and more."
kind: "package-reference"
---

# @anotherharness/ah-web-search-searxng

English | [中文](README.zh.md)

## Summary

`ah-web-search-searxng` connects the harness to a self-hosted [SearXNG](https://searxng.github.io/searxng/) instance. SearXNG is a free, open-source meta search engine that queries Google, Bing, DuckDuckGo, GitHub, Wikipedia, arXiv, Stack Overflow and dozens of other engines simultaneously — with no API key and no external account required. The model-facing `web_search` tool lives in `ah-tool-web`.

## Quick start

**1. Start SearXNG** (one command, requires Docker):
```bash
docker compose -f docker/searxng.yml up -d
```

**2. Set the env var** to activate SearXNG as the search provider:
```bash
export AH_WEB_SEARCH_PROVIDER=searxng
```

**3. Start the harness** — `web_search` now routes through your local SearXNG.

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `baseURL` | `$SEARXNG_BASE_URL` → `http://127.0.0.1:8888` | SearXNG instance URL |
| `categories` | `$SEARXNG_CATEGORIES` → `general` | Comma-separated SearXNG categories (`general`, `it`, `science`, etc.) |
| `language` | `$SEARXNG_LANGUAGE` → `all` | Language filter (`en`, `pt`, `all`) |
| `numResults` | (unset) | Default result count; SearXNG returns all engines' results when unset |

## Switching providers

The base bundle has both DeepSeek (default) and SearXNG registered. Switch at runtime:

```bash
export AH_WEB_SEARCH_PROVIDER=searxng  # self-hosted, free

export AH_WEB_SEARCH_PROVIDER=deepseek-official  # requires DEEPSEEK_API_KEY
```

Or pin it in a profile `cordis.patch.yml`:
```yaml
- id: web
  name: '@anotherharness/ah-web'
  config:
    searchProvider: searxng
    fetchProvider: http
```

## Coverage

SearXNG aggregates results from (configured in `docker/searxng-config/settings.yml`):

| Engine | Category |
|---|---|
| Google, Bing, Brave, DuckDuckGo | general |
| GitHub, Stack Overflow, npm | it |
| Wikipedia | general |
| arXiv | science |

Add more engines by editing `docker/searxng-config/settings.yml` and restarting.
