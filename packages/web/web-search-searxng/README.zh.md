---
description: "AnotherHarness 网页能力接缝（ctx.web）的 SearXNG 本地搜索提供商 — 无需 API Key，聚合 Google、Bing、DuckDuckGo、GitHub、arXiv 等。"
kind: "package-reference"
---

# @anotherharness/ah-web-search-searxng

[English](README.md) | 中文

## 概述

`ah-web-search-searxng` 将 harness 连接到一个自托管的 [SearXNG](https://searxng.github.io/searxng/) 实例。SearXNG 是一个免费、开源的元搜索引擎，可同时查询 Google、Bing、DuckDuckGo、GitHub、Wikipedia、arXiv、Stack Overflow 等数十个引擎 — 无需 API Key，无需外部账号。模型侧的 `web_search` 工具位于 `ah-tool-web`。

## 使用本包

**1. 启动 SearXNG**（需要 Docker）：
```bash
docker compose -f docker/searxng.yml up -d
```

**2. 设置环境变量**以激活 SearXNG 为搜索提供商：
```bash
export AH_WEB_SEARCH_PROVIDER=searxng
```

**3. 启动 harness** — `web_search` 现在将通过本地 SearXNG 路由。

## 配置

| 字段 | 默认值 | 说明 |
|---|---|---|
| `baseURL` | `$SEARXNG_BASE_URL` → `http://127.0.0.1:8888` | SearXNG 实例地址 |
| `categories` | `$SEARXNG_CATEGORIES` → `general` | 逗号分隔的 SearXNG 分类（`general`、`it`、`science` 等） |
| `language` | `$SEARXNG_LANGUAGE` → `all` | 语言过滤（`en`、`zh`、`all`） |
| `numResults` | （未设置） | 默认结果数量；未设置时返回所有引擎的结果 |

## 切换提供商

base bundle 同时注册了 DeepSeek（默认）和 SearXNG。可在运行时切换：

```bash
export AH_WEB_SEARCH_PROVIDER=searxng  # self-hosted, free

export AH_WEB_SEARCH_PROVIDER=deepseek-official  # requires DEEPSEEK_API_KEY
```

也可在 profile 的 `cordis.patch.yml` 中固定：
```yaml
- id: web
  name: '@anotherharness/ah-web'
  config:
    searchProvider: searxng
    fetchProvider: http
```

## 引擎覆盖范围

SearXNG 聚合以下引擎（配置于 `docker/searxng-config/settings.yml`）：

| 引擎 | 分类 |
|---|---|
| Google、Bing、Brave、DuckDuckGo | general |
| GitHub、Stack Overflow、npm | it |
| Wikipedia | general |
| arXiv | science |

通过编辑 `docker/searxng-config/settings.yml` 并重启可添加更多引擎。
