# Changelog

### 0.1.0

- Initial extraction of the sidebar playlist sorter & filter from `betterytm-song-playlists`.
- Scaffolded from the [BetterYTM plugin template](https://github.com/Sv443/BetterYTM-Plugin-Template).
- Alphabetical, inverse alphabetical, Recently Played, Recent Activity, and Default sort modes.
- Live filter input with clear button.
- Server-backed recency ordering via InnerTube (`FEmusic_liked_playlists`) with continuation pagination.
- Pure CSS `order`-based visual layout; playlist DOM nodes are never moved.

### 0.1.1

- Fix: the sorter now initializes reliably. Previously the plugin registered but never modified the UI, because the `bytm:ready` subscription raced the event (`pluginRegistered` is deferred by a `setTimeout`, while `bytm:ready` fires synchronously during BYTM's init). The plugin now registers, subscribes synchronously, and starts through a once-guard.
- Compatibility with BYTM v4: `await` the plugin registration call.
- Removed extraneous `ReadFeatureConfig` and `CreateModalDialogs` intents; this plugin needs no BYTM permissions.
