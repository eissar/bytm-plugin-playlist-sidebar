# BetterYTM - Playlist Sidebar

<div style="text-align: center;" align="center">

<p>Sorts and filters the YouTube Music sidebar playlist list, with server-backed Recently Played and Recent Activity orders.</p>

</div>

> Built on the [BetterYTM plugin template](https://github.com/Sv443/BetterYTM-Plugin-Template); interfaces with the [BetterYTM](https://github.com/Sv443/BetterYTM) project under the [BetterYTM Plugin Sublicense Agreement v2](https://github.com/Sv443/BetterYTM/blob/main/license-for-plugins.txt).

---

## Overview

This plugin adds a compact **filter input** and **sort button** to the second section of the YouTube Music sidebar guide (the list of your library playlists).

- **Filter** — type to narrow the visible playlists live.
- **Sort** — pick one of the modes below from the dropdown:

| Mode | Description |
| --- | --- |
| Alphabetical (A → Z) | Sorts by title ascending. |
| Inverse Alphabetical (Z → A) | Sorts by title descending. |
| Recently Played | Server-backed order using YouTube's "Recently played" sort params. |
| Recent Activity | Server-backed default library order (ordered by recent activity). |
| Default | Restores YouTube Music's native order. |

The chosen mode is persisted in `localStorage` under `bytm_playlist_sort_mode`.

## How it works

Visual ordering is applied exclusively through the CSS `order` property. Playlist nodes are **never moved** in the DOM, so Polymer's stamped child indices stay intact and nothing breaks on re-render. Pinned entries (Liked Music, Episodes, pinned playlists, the "New playlist" action) keep fixed negative `order` values.

Recency modes (`Recently Played`, `Recent Activity`) fetch the real order from YouTube Music's InnerTube `browse` endpoint (`FEmusic_liked_playlists`), including pagination via continuation tokens. There is **no local playback tracking or LRU cache** — the order always comes from the server.

The sorter is initialized on the `bytm:ready` event so it only runs after BetterYTM has registered the plugin and the DOM is ready.

## Prerequisites

This is a plugin for **[BetterYTM](https://github.com/Sv443/BetterYTM)**. Ensure you have BetterYTM installed in your userscript manager ([Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/)) before installing this plugin.

## Installation

Install the built userscript via Violentmonkey or Tampermonkey:
- [Download / Install UserScript](https://github.com/eissar/bytm-plugin-playlist-sidebar/releases/latest/download/bytm-plugin-playlist-sidebar.user.js)

## Development

This project uses [pnpm](https://pnpm.io/) and the [BetterYTM plugin template](https://github.com/Sv443/BetterYTM-Plugin-Template).

```bash
# Install dependencies
pnpm install

# Start local dev server with auto-rebuild (port 8767)
pnpm dev

# Lint source files
pnpm lint

# Build production userscript
pnpm build
```

## License

MIT
