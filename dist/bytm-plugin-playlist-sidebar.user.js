// ==UserScript==
// @name         BetterYTM Playlist Sidebar
// @namespace    https://github.com/eissar
// @version      0.1.0
// @author       eissar
// @description  Sorts and filters the YouTube Music sidebar playlist list, with server-backed Recently Played and Recent Activity orders.
// @license      MIT
// @copyright    Copyright 2026 eissar
// @icon         https://raw.githubusercontent.com/eissar/bytm-plugin-playlist-sidebar/357d167/assets/plugin_icon_128x128.png#sha256=4GgH3wuDgVjYVPf1s6NURcDU0QvjnLCigrlKowsF6x8=
// @homepage     https://github.com/eissar/bytm-plugin-playlist-sidebar
// @homepageURL  https://github.com/eissar/bytm-plugin-playlist-sidebar
// @source       https://github.com/eissar/bytm-plugin-playlist-sidebar.git
// @supportURL   https://github.com/eissar/bytm-plugin-playlist-sidebar/issues
// @match        https://youtube.com/*
// @match        https://music.youtube.com/*
// @resource     icon_1000  https://raw.githubusercontent.com/eissar/bytm-plugin-playlist-sidebar/357d167/assets/plugin_icon_1000x1000.png#sha256=IrFR29ZTCXuH5WsSVcmPn5FA+GvBopOyGR9lFSi4s5c=
// @resource     icon_128   https://raw.githubusercontent.com/eissar/bytm-plugin-playlist-sidebar/357d167/assets/plugin_icon_128x128.png#sha256=4GgH3wuDgVjYVPf1s6NURcDU0QvjnLCigrlKowsF6x8=
// @connect      i.ytimg.com
// @connect      youtube.com
// @connect      github.com
// @connect      raw.githubusercontent.com
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  var PluginIntent = /* @__PURE__ */ ((PluginIntent2) => {
    PluginIntent2[PluginIntent2["ReadFeatureConfig"] = 1] = "ReadFeatureConfig";
    PluginIntent2[PluginIntent2["WriteFeatureConfig"] = 2] = "WriteFeatureConfig";
    PluginIntent2[PluginIntent2["SeeHiddenConfigValues"] = 4] = "SeeHiddenConfigValues";
    PluginIntent2[PluginIntent2["WriteLyricsCache"] = 8] = "WriteLyricsCache";
    PluginIntent2[PluginIntent2["WriteTranslations"] = 16] = "WriteTranslations";
    PluginIntent2[PluginIntent2["CreateModalDialogs"] = 32] = "CreateModalDialogs";
    PluginIntent2[PluginIntent2["ReadAutoLikeData"] = 64] = "ReadAutoLikeData";
    PluginIntent2[PluginIntent2["WriteAutoLikeData"] = 128] = "WriteAutoLikeData";
    PluginIntent2[PluginIntent2["InternalAccess"] = 256] = "InternalAccess";
    PluginIntent2[PluginIntent2["FullAccess"] = 512] = "FullAccess";
    return PluginIntent2;
  })(PluginIntent || {});
  const userscriptName = "BetterYTM Playlist Sidebar";
  const description = "Sorts and filters the YouTube Music sidebar playlist list, with server-backed Recently Played and Recent Activity orders.";
  const version = "0.1.0";
  const homepage = "https://github.com/eissar/bytm-plugin-playlist-sidebar";
  const changelogUrl = "https://github.com/eissar/bytm-plugin-playlist-sidebar/blob/main/changelog.md";
  const namespace = "https://github.com/eissar";
  const license = "MIT";
  const licenseUrl = "https://github.com/eissar/bytm-plugin-playlist-sidebar/blob/main/LICENSE.txt";
  const bugs = {
    url: "https://github.com/eissar/bytm-plugin-playlist-sidebar/issues"
  };
  const packageJson = {
    userscriptName,
    description,
    version,
    homepage,
    changelogUrl,
    namespace,
    license,
    licenseUrl,
    bugs
  };
  const pluginDef = {
    // The permissions of the plugin:
    intents: [
      PluginIntent.ReadFeatureConfig,
      PluginIntent.CreateModalDialogs
    ],
    // The metadata of the plugin:
    plugin: {
      name: packageJson.userscriptName,
      namespace: packageJson.namespace,
      description: {
        "en-US": packageJson.description
      },
      homepage: {
        source: packageJson.homepage,
        changelog: packageJson.changelogUrl,
        bug: packageJson.bugs.url
      },
      version: packageJson.version,
      license: {
        name: packageJson.license,
        // should be a valid SPDX license identifier, or "UNLICENSED" to explicitly state the plugin is "all rights reserved"
        url: packageJson.licenseUrl
      },
      // If you have a logo, you can add it here - it should *ideally* be square and between 48x48 and 128x128.
      // Also make sure it is hosted on a server where CORS is enabled (like the GitHub CDN below), otherwise the browser will block it.
      iconUrl: "https://raw.githubusercontent.com/eissar/bytm-plugin-playlist-sidebar/main/assets/plugin_icon_128x128.png"
    }
    // If you have contributors defined in package.json, you can add them here:
    // contributors,
  };
  let events;
  async function tryRegisterPlugin(event) {
    const res = event.detail(pluginDef);
    events = res.events;
    res.token;
    return await events.once("pluginRegistered");
  }
  const consPrefix = `[${packageJson.userscriptName}]`;
  function log(...args) {
    console.log(consPrefix, ...args);
  }
  const rawConsts = {
    buildMode: "production",
    buildNumber: "357d167"
  };
  const getConst = (constKey, defaultVal) => {
    const val = rawConsts[constKey];
    return val.match(/^#{{.+}}$/) ? defaultVal : val;
  };
  const buildMode = getConst("buildMode", "production");
  const buildNumber = getConst("buildNumber", "BUILD_ERROR");
  const STORAGE_MODE_KEY = "bytm_playlist_sort_mode";
  const BUTTON_ID = "bytm-playlist-sort-btn";
  const DROPDOWN_ID = "bytm-playlist-sort-dropdown";
  const FILTER_ROW_ID = "bytm-playlist-filter-row";
  const FILTER_INPUT_ID = "bytm-playlist-filter-input";
  function getCurrentSortMode() {
    try {
      const saved = localStorage.getItem(STORAGE_MODE_KEY);
      if (saved === "a-z" || saved === "z-a" || saved === "recent-played" || saved === "recent-activity" || saved === "default") {
        return saved;
      }
    } catch {
    }
    return "a-z";
  }
  function setStoredSortMode(mode) {
    try {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    } catch {
    }
  }
  let cachedActivityOrder = null;
  let cachedPlayedOrder = null;
  let cachedRecentlyPlayedParam = null;
  function getInnertubeConfig() {
    var _a, _b;
    const ytcfg = typeof unsafeWindow !== "undefined" && unsafeWindow.ytcfg || window.ytcfg;
    const apiKey = ((_a = ytcfg == null ? void 0 : ytcfg.get) == null ? void 0 : _a.call(ytcfg, "INNERTUBE_API_KEY")) || "";
    const clientVersion = ((_b = ytcfg == null ? void 0 : ytcfg.get) == null ? void 0 : _b.call(ytcfg, "INNERTUBE_CLIENT_VERSION")) || "2.20250101.00.00";
    const origin = location.origin || "https://music.youtube.com";
    return { apiKey, clientVersion, origin };
  }
  async function getSapisidHash(origin) {
    try {
      const match = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]*)/);
      const sapisid = match ? match[1] : null;
      if (!sapisid) return null;
      const now = Math.floor(Date.now() / 1e3);
      const buffer = await crypto.subtle.digest(
        "SHA-1",
        new TextEncoder().encode(`${now} ${sapisid} ${origin}`)
      );
      const hash = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
      return `${now}_${hash}`;
    } catch (err) {
      console.warn("[BetterYTM Playlist Sidebar] Error computing SAPISIDHASH:", err);
      return null;
    }
  }
  async function callInnertubeBrowse(options) {
    const config = getInnertubeConfig();
    if (!config.apiKey) {
      console.error("[BetterYTM Playlist Sidebar] INNERTUBE_API_KEY not found in ytcfg!");
      return null;
    }
    const sapisidHash = await getSapisidHash(config.origin);
    const headers = {
      "Content-Type": "application/json",
      "X-Origin": config.origin,
      "X-YouTube-Client-Name": "67",
      "X-YouTube-Client-Version": config.clientVersion
    };
    if (sapisidHash) {
      headers["Authorization"] = `SAPISIDHASH ${sapisidHash}`;
    } else {
      console.warn("[BetterYTM Playlist Sidebar] No SAPISID cookie found; request may lack authentication.");
    }
    const body = {
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: config.clientVersion,
          hl: "en",
          gl: "US"
        }
      }
    };
    if (options.continuation) {
      body.continuation = options.continuation;
    } else if (options.browseId) {
      body.browseId = options.browseId;
      if (options.params) body.params = options.params;
    } else {
      console.error("[BetterYTM Playlist Sidebar] callInnertubeBrowse requires browseId or continuation.");
      return null;
    }
    try {
      const url = `/youtubei/v1/browse?key=${config.apiKey}`;
      log(
        `Sending InnerTube POST to ${url} (browseId: ${options.browseId || "none"}, params: ${options.params || "none"}, continuation: ${options.continuation ? "yes" : "none"})...`
      );
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body)
      });
      log(`InnerTube response status: ${res.status} ${res.statusText}`);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`[BetterYTM Playlist Sidebar] InnerTube HTTP error ${res.status}:`, errText.slice(0, 300));
        return null;
      }
      const json = await res.json();
      return json;
    } catch (err) {
      console.error("[BetterYTM Playlist Sidebar] InnerTube fetch exception:", err);
      return null;
    }
  }
  function normalizePlaylistId(raw) {
    if (!raw) return null;
    let id = raw.trim();
    try {
      id = decodeURIComponent(id);
    } catch {
    }
    if (id.startsWith("VL")) id = id.slice(2);
    if (!id || id.startsWith("FE") || id.startsWith("UC") || id.startsWith("MP")) return null;
    return id;
  }
  function normalizeTitle(value) {
    return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  function jsonText(node) {
    if (node == null) return "";
    if (typeof node === "string") return node;
    if (typeof node !== "object") return "";
    const rec = node;
    if (typeof rec.simpleText === "string") return rec.simpleText;
    if (typeof rec.content === "string") return rec.content;
    if (Array.isArray(rec.runs)) {
      return rec.runs.map((run) => run && typeof run === "object" && typeof run.text === "string" ? run.text : "").join("");
    }
    return "";
  }
  function extractPlaylistIdFromHref(href) {
    if (!href) return null;
    try {
      const url = new URL(href, location.origin);
      const fromQuery = normalizePlaylistId(url.searchParams.get("list"));
      if (fromQuery) return fromQuery;
      const browse = url.pathname.match(/\/browse\/([^/]+)/);
      if (browse) return normalizePlaylistId(browse[1]);
    } catch {
    }
    const listMatch = href.match(/[?&]list=([^&]+)/);
    if (listMatch) return normalizePlaylistId(listMatch[1]);
    const browseMatch = href.match(/browse\/(VL[^/?&]+)/);
    if (browseMatch) return normalizePlaylistId(browseMatch[1]);
    return null;
  }
  const SKIP_JSON_KEYS = /* @__PURE__ */ new Set([
    "menu",
    "menuRenderer",
    "menuNavigationItemRenderer",
    "menuServiceItemRenderer",
    "toggleMenuServiceItemRenderer",
    "contextMenu",
    "overlay",
    "loggingContext",
    "clickTrackingParams",
    "trackingParams"
  ]);
  function extractServerPlaylists(json) {
    if (!json || typeof json !== "object") {
      console.warn("[BetterYTM Playlist Sidebar] extractServerPlaylists: response is not an object", json);
      return [];
    }
    const list = [];
    const seen = /* @__PURE__ */ new Set();
    const consider = (rawId, title) => {
      if (typeof rawId !== "string") return;
      const id = normalizePlaylistId(rawId);
      if (!id || id === "LM" || id === "SE" || seen.has(id)) return;
      seen.add(id);
      list.push({ id, title: title.trim() });
    };
    const walk = (node, inheritedTitle, depth) => {
      var _a, _b, _c, _d, _e;
      if (!node || typeof node !== "object" || depth > 40) return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item, inheritedTitle, depth + 1);
        return;
      }
      const rec = node;
      const title = jsonText(rec.title) || jsonText(rec.formattedTitle) || jsonText(rec.text) || jsonText((_b = (_a = rec.accessibility) == null ? void 0 : _a.accessibilityData) == null ? void 0 : _b.label) || inheritedTitle;
      consider(rec.browseId, title);
      consider(rec.playlistId, title);
      consider((_c = rec.browseEndpoint) == null ? void 0 : _c.browseId, title);
      consider((_d = rec.watchPlaylistEndpoint) == null ? void 0 : _d.playlistId, title);
      consider((_e = rec.watchEndpoint) == null ? void 0 : _e.playlistId, title);
      for (const [key, val] of Object.entries(rec)) {
        if (SKIP_JSON_KEYS.has(key)) continue;
        walk(val, title, depth + 1);
      }
    };
    walk(json, "", 0);
    log(`Extracted ${list.length} playlists from response. Sample:`, list.slice(0, 3));
    if (list.length === 0) {
      console.warn("[BetterYTM Playlist Sidebar] 0 playlists extracted. Top-level keys:", Object.keys(json));
    }
    return list;
  }
  function extractLibrarySortParams(json) {
    const found = {};
    const walk = (node, depth = 0) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (!node || typeof node !== "object" || depth > 30) return;
      const rec = node;
      const renderer = rec.dropdownItemRenderer || rec.chipCloudChipRenderer || rec.sortFilterSubMenuItemRenderer;
      if (renderer && typeof renderer === "object") {
        const item = renderer;
        const label = (jsonText(item.label) || jsonText(item.title) || jsonText(item.text) || jsonText((_b = (_a = item.accessibility) == null ? void 0 : _a.accessibilityData) == null ? void 0 : _b.label)).toLowerCase().trim();
        const params = ((_d = (_c = item.navigationEndpoint) == null ? void 0 : _c.browseEndpoint) == null ? void 0 : _d.params) || ((_f = (_e = item.onSelectCommand) == null ? void 0 : _e.browseEndpoint) == null ? void 0 : _f.params) || ((_h = (_g = item.command) == null ? void 0 : _g.browseEndpoint) == null ? void 0 : _h.params) || ((_j = (_i = item.chipEndpoint) == null ? void 0 : _i.browseEndpoint) == null ? void 0 : _j.params);
        if (label && typeof params === "string") {
          if (!found.played && label.includes("recently played")) {
            found.played = params;
            log(`Library sort "Recently played" params from label "${label}"`);
          } else if (!found.activity && (label === "recents" || label.includes("recent activity")) && !label.includes("played")) {
            found.activity = params;
            log(`Library sort "Recents" params from label "${label}"`);
          }
        }
      }
      for (const val of Object.values(rec)) walk(val, depth + 1);
    };
    walk(json);
    return found;
  }
  function extractContinuationToken(json) {
    let token = null;
    const walk = (node, depth = 0) => {
      var _a, _b, _c, _d, _e, _f;
      if (!node || typeof node !== "object" || token || depth > 30) return;
      const rec = node;
      if (rec.continuationItemRenderer) {
        const cir = rec.continuationItemRenderer;
        const found = ((_b = (_a = cir.continuationEndpoint) == null ? void 0 : _a.continuationCommand) == null ? void 0 : _b.token) || ((_f = (_e = (_d = (_c = cir.button) == null ? void 0 : _c.buttonRenderer) == null ? void 0 : _d.command) == null ? void 0 : _e.continuationCommand) == null ? void 0 : _f.token);
        if (typeof found === "string" && found) {
          token = found;
          return;
        }
      }
      if (rec.nextContinuationData) {
        const found = rec.nextContinuationData.continuation;
        if (typeof found === "string" && found) {
          token = found;
          return;
        }
      }
      for (const val of Object.values(rec)) {
        walk(val, depth + 1);
      }
    };
    walk(json);
    return token;
  }
  async function fetchAllBrowsePlaylists(browseId, params) {
    const all = [];
    const seenIds = /* @__PURE__ */ new Set();
    const seenTokens = /* @__PURE__ */ new Set();
    let continuation;
    let firstPage = null;
    let page = 0;
    while (page < 20) {
      page++;
      const json = continuation ? await callInnertubeBrowse({ continuation }) : await callInnertubeBrowse({ browseId, params });
      if (!json) break;
      if (page === 1) firstPage = json;
      const items = extractServerPlaylists(json);
      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          all.push(item);
        }
      }
      const next = extractContinuationToken(json);
      if (!next || seenTokens.has(next)) break;
      seenTokens.add(next);
      continuation = next;
      log(`Library page ${page}: +${items.length} this page, ${all.length} unique so far, fetching continuation...`);
    }
    log(`Fetched ${all.length} unique playlists from ${browseId} across ${page} page(s).`);
    return { items: all, firstPage };
  }
  async function fetchRecentActivityOrder() {
    log("Fetching recent activity order from server...");
    const { items, firstPage } = await fetchAllBrowsePlaylists("FEmusic_liked_playlists");
    if (!firstPage) {
      console.error("[BetterYTM Playlist Sidebar] Failed to retrieve response for FEmusic_liked_playlists.");
      return cachedActivityOrder || [];
    }
    const sortParams = extractLibrarySortParams(firstPage);
    if (sortParams.played) {
      cachedRecentlyPlayedParam = sortParams.played;
    }
    if (items.length > 0) {
      cachedActivityOrder = items;
    }
    return items;
  }
  async function fetchRecentlyPlayedOrder() {
    log("Fetching recently played order from server...");
    if (!cachedRecentlyPlayedParam) {
      await fetchRecentActivityOrder();
    }
    if (!cachedRecentlyPlayedParam) {
      console.warn("[BetterYTM Playlist Sidebar] No Recently played sort params in library response.");
      return cachedPlayedOrder || [];
    }
    log(`Fetching Library playlists with sort param: "${cachedRecentlyPlayedParam}"...`);
    const { items } = await fetchAllBrowsePlaylists("FEmusic_liked_playlists", cachedRecentlyPlayedParam);
    if (items.length > 0) {
      cachedPlayedOrder = items;
      return items;
    }
    console.warn("[BetterYTM Playlist Sidebar] Could not retrieve recently played order from server.");
    return cachedPlayedOrder || [];
  }
  function cleanupPrimarySection() {
    const primarySection = document.querySelector(
      "ytmusic-guide-section-renderer[is-primary] #items"
    );
    if (primarySection) {
      primarySection.style.removeProperty("display");
      primarySection.style.removeProperty("flex-direction");
      primarySection.querySelectorAll("ytmusic-guide-entry-renderer").forEach((el) => {
        el.style.removeProperty("order");
      });
    }
  }
  function cleanupNewPlaylistButton() {
    const newPlaylistBtn = findNewPlaylistButton();
    if (newPlaylistBtn) {
      const anchor = newPlaylistBtn.closest("yt-button-shape") ?? newPlaylistBtn;
      anchor.style.removeProperty("flex");
      anchor.style.removeProperty("min-width");
      const parent = anchor.parentElement;
      if (parent && parent.id !== FILTER_ROW_ID) {
        parent.style.removeProperty("display");
        parent.style.removeProperty("flex-direction");
        parent.style.removeProperty("align-items");
        parent.style.removeProperty("justify-content");
        parent.style.removeProperty("gap");
      }
    }
  }
  function getPlaylistSectionAndScroller() {
    const filterRow = document.getElementById(FILTER_ROW_ID);
    if (filterRow) {
      const scroller = filterRow.closest("#items");
      const section = filterRow.closest("ytmusic-guide-section-renderer");
      if (scroller) return { section, scroller };
    }
    const lmEntry = document.querySelector('#guide a[href*="list=LM"]') || document.querySelector('#guide a[href*="VLLM"]') || Array.from(document.querySelectorAll("#guide ytmusic-guide-entry-renderer")).find((el) => {
      var _a, _b;
      const title = (_b = (_a = el.querySelector(".title-group .title, .title")) == null ? void 0 : _a.textContent) == null ? void 0 : _b.trim().toLowerCase();
      return title === "liked music";
    });
    if (lmEntry) {
      const scroller = lmEntry.closest("#items");
      const section = lmEntry.closest("ytmusic-guide-section-renderer");
      if (scroller) return { section, scroller };
    }
    const newPlaylistBtn = findNewPlaylistButton();
    if (newPlaylistBtn) {
      const section = newPlaylistBtn.closest("ytmusic-guide-section-renderer");
      const scroller = (section == null ? void 0 : section.querySelector("#items")) ?? null;
      if (scroller) return { section, scroller };
    }
    return { section: null, scroller: null };
  }
  function findNewPlaylistButton() {
    return document.querySelector('#guide button[aria-label="New playlist"]') || document.querySelector("#guide-content ytmusic-guide-section-renderer button.ytSpecButtonShapeNextHost") || document.querySelector("#guide-content yt-button-shape button") || document.querySelector('#guide a[href*="create_playlist"]') || null;
  }
  function getEntryDetails(entry) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    const polymer = entry;
    const data = polymer.data || polymer.__data;
    let title = ((_c = (_b = (_a = data == null ? void 0 : data.formattedTitle) == null ? void 0 : _a.runs) == null ? void 0 : _b[0]) == null ? void 0 : _c.text) || ((_f = (_e = (_d = data == null ? void 0 : data.title) == null ? void 0 : _d.runs) == null ? void 0 : _e[0]) == null ? void 0 : _f.text) || ((_g = data == null ? void 0 : data.title) == null ? void 0 : _g.simpleText) || "";
    const browseId = ((_i = (_h = data == null ? void 0 : data.navigationEndpoint) == null ? void 0 : _h.browseEndpoint) == null ? void 0 : _i.browseId) || "";
    let playlistId = browseId.startsWith("VL") ? browseId.substring(2) : browseId || null;
    if (!title) {
      const root = entry.shadowRoot ?? entry;
      const titleEl = entry.querySelector("yt-formatted-string.title, .title-group yt-formatted-string, .title") || root.querySelector("yt-formatted-string.title, .title-group yt-formatted-string, .title");
      title = ((_j = titleEl == null ? void 0 : titleEl.textContent) == null ? void 0 : _j.trim()) || "";
    }
    if (!title) {
      title = (entry.textContent || "").replace(/\s+/g, " ").trim();
    }
    if (!playlistId) {
      const anchors = [];
      const collectAnchors = (root) => {
        root.querySelectorAll("a").forEach((a) => anchors.push(a));
        root.querySelectorAll("*").forEach((el) => {
          if (el.shadowRoot) collectAnchors(el.shadowRoot);
        });
      };
      collectAnchors(entry);
      if (entry.shadowRoot) collectAnchors(entry.shadowRoot);
      for (const link of anchors) {
        const id = extractPlaylistIdFromHref(link.getAttribute("href") || link.href || "");
        if (id) {
          playlistId = id;
          break;
        }
      }
    } else {
      playlistId = normalizePlaylistId(playlistId);
    }
    const lowerTitle = title.toLowerCase();
    const isCreateAction = Boolean((_k = data == null ? void 0 : data.navigationEndpoint) == null ? void 0 : _k.createPlaylistEndpoint) || entry.classList.contains("guide-entry-renderer-pinned");
    if (isCreateAction) {
      return { title: "", playlistId: null, isPinned: true, pinnedOrder: -999 };
    }
    if (lowerTitle === "liked music" || playlistId === "LM") {
      return { title, playlistId: "LM", isPinned: true, pinnedOrder: -998 };
    }
    if (lowerTitle === "episodes" || playlistId === "SE") {
      return { title, playlistId: "SE", isPinned: true, pinnedOrder: -997 };
    }
    const hasPinnedBadge = Boolean(
      entry.querySelector('yt-icon[title="Pinned"], yt-icon[aria-label="Pinned"], ytmusic-inline-badge-renderer')
    );
    if (hasPinnedBadge) {
      return { title, playlistId, isPinned: true, pinnedOrder: -990 };
    }
    return { title, playlistId, isPinned: false, pinnedOrder: 0 };
  }
  function ensureFilterStyles() {
    var _a;
    const STYLE_ID = "bytm-playlist-filter-styles";
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    ytmusic-guide-entry-renderer.bytm-playlist-filtered-out {
      display: none !important;
    }
    #${FILTER_INPUT_ID}::placeholder {
      color: rgba(255, 255, 255, 0.45);
      font-size: 11.5px;
    }
    #${FILTER_INPUT_ID}:focus {
      outline: none;
    }
    .bytm-filter-input-wrapper:focus-within {
      border-color: rgba(255, 255, 255, 0.3) !important;
      background-color: rgba(255, 255, 255, 0.12) !important;
    }
    #${BUTTON_ID} {
      width: 26px !important;
      height: 26px !important;
      min-width: 26px !important;
      max-width: 26px !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    #${BUTTON_ID}:hover {
      background-color: rgba(255, 255, 255, 0.16) !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
    }
  `;
    (_a = document.head) == null ? void 0 : _a.appendChild(style);
  }
  function filterPlaylists(scroller, query) {
    const cleanQuery = query.trim().toLowerCase();
    const entries = scroller.querySelectorAll("ytmusic-guide-entry-renderer");
    entries.forEach((entry) => {
      if (!cleanQuery) {
        entry.classList.remove("bytm-playlist-filtered-out");
        return;
      }
      const details = getEntryDetails(entry);
      const haystack = `${details.title} ${details.playlistId ?? ""} ${(entry.textContent || "").replace(/\s+/g, " ")}`.toLowerCase();
      entry.classList.toggle("bytm-playlist-filtered-out", !haystack.includes(cleanQuery));
    });
  }
  function createFilterRow(scroller) {
    ensureFilterStyles();
    const row = document.createElement("div");
    row.id = FILTER_ROW_ID;
    row.style.setProperty("order", "-1000", "important");
    row.style.setProperty("height", "26px", "important");
    row.style.setProperty("min-height", "26px", "important");
    row.style.setProperty("max-height", "26px", "important");
    row.style.setProperty("box-sizing", "border-box", "important");
    row.style.setProperty("margin", "4px 12px 6px 12px", "important");
    row.style.setProperty("display", "flex", "important");
    row.style.setProperty("align-items", "center", "important");
    row.style.setProperty("gap", "6px", "important");
    row.style.setProperty("flex-shrink", "0", "important");
    const inputWrapper = document.createElement("div");
    inputWrapper.className = "bytm-filter-input-wrapper";
    inputWrapper.style.setProperty("flex", "1", "important");
    inputWrapper.style.setProperty("min-width", "0", "important");
    inputWrapper.style.setProperty("height", "26px", "important");
    inputWrapper.style.setProperty("box-sizing", "border-box", "important");
    inputWrapper.style.setProperty("padding", "0 8px", "important");
    inputWrapper.style.setProperty("display", "flex", "important");
    inputWrapper.style.setProperty("align-items", "center", "important");
    inputWrapper.style.setProperty("background-color", "rgba(255, 255, 255, 0.08)", "important");
    inputWrapper.style.setProperty("border-radius", "6px", "important");
    inputWrapper.style.setProperty("border", "1px solid rgba(255, 255, 255, 0.1)", "important");
    inputWrapper.style.setProperty("transition", "border-color 0.2s, background-color 0.2s", "important");
    const searchSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    searchSvg.setAttribute("viewBox", "0 0 24 24");
    searchSvg.setAttribute("width", "13");
    searchSvg.setAttribute("height", "13");
    searchSvg.setAttribute("fill", "rgba(255, 255, 255, 0.5)");
    searchSvg.style.display = "block";
    searchSvg.style.flexShrink = "0";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M20.87 19.46l-4.54-4.54A7.47 7.47 0 0 0 18 10.5 7.5 7.5 0 1 0 10.5 18a7.47 7.47 0 0 0 4.42-1.67l4.54 4.54.08.08a1 1 0 0 0 1.41-1.41l-.08-.08zM10.5 16A5.5 5.5 0 1 1 16 10.5 5.51 5.51 0 0 1 10.5 16z"
    );
    searchSvg.appendChild(path);
    inputWrapper.appendChild(searchSvg);
    const input = document.createElement("input");
    input.id = FILTER_INPUT_ID;
    input.type = "text";
    input.placeholder = "Filter playlists...";
    input.setAttribute("aria-label", "Filter playlists");
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.border = "none";
    input.style.background = "transparent";
    input.style.color = "#ffffff";
    input.style.fontSize = "11.5px";
    input.style.lineHeight = "14px";
    input.style.width = "100%";
    input.style.marginLeft = "6px";
    input.style.padding = "0";
    input.style.fontFamily = 'Roboto, "YouTube Sans", "Noto Sans", sans-serif';
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.setAttribute("aria-label", "Clear filter");
    clearBtn.style.display = "none";
    clearBtn.style.alignItems = "center";
    clearBtn.style.justifyContent = "center";
    clearBtn.style.background = "transparent";
    clearBtn.style.border = "none";
    clearBtn.style.color = "rgba(255, 255, 255, 0.5)";
    clearBtn.style.cursor = "pointer";
    clearBtn.style.padding = "0";
    clearBtn.style.fontSize = "14px";
    clearBtn.style.lineHeight = "14px";
    clearBtn.style.width = "16px";
    clearBtn.style.height = "16px";
    clearBtn.style.flexShrink = "0";
    clearBtn.textContent = "×";
    clearBtn.addEventListener("mouseenter", () => {
      clearBtn.style.color = "#ffffff";
    });
    clearBtn.addEventListener("mouseleave", () => {
      clearBtn.style.color = "rgba(255, 255, 255, 0.5)";
    });
    const updateFilter = () => {
      const val = input.value;
      clearBtn.style.display = val ? "flex" : "none";
      filterPlaylists(scroller, val);
    };
    input.addEventListener("input", updateFilter);
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") {
        input.value = "";
        updateFilter();
        input.blur();
      }
    });
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      input.value = "";
      updateFilter();
      input.focus();
    });
    inputWrapper.appendChild(input);
    inputWrapper.appendChild(clearBtn);
    row.appendChild(inputWrapper);
    const sortBtn = createSortButton();
    row.appendChild(sortBtn);
    return row;
  }
  function ensureScrollerFlex(scroller) {
    scroller.style.setProperty("display", "flex", "important");
    scroller.style.setProperty("flex-direction", "column", "important");
  }
  function ensureFilterRow(scroller) {
    ensureScrollerFlex(scroller);
    const existingRow = document.getElementById(FILTER_ROW_ID);
    if (existingRow && scroller.contains(existingRow)) {
      existingRow.style.setProperty("order", "-1000", "important");
      if (!existingRow.querySelector(`#${BUTTON_ID}`)) {
        existingRow.appendChild(createSortButton());
      }
      return;
    }
    if (existingRow) {
      existingRow.style.setProperty("order", "-1000", "important");
      return;
    }
    const filterRow = createFilterRow(scroller);
    scroller.appendChild(filterRow);
  }
  function applyPlaylistSort(options = {}) {
    cleanupPrimarySection();
    cleanupNewPlaylistButton();
    const scroller = options.scroller ?? getPlaylistSectionAndScroller().scroller;
    if (!scroller) return;
    ensureFilterRow(scroller);
    ensureScrollerFlex(scroller);
    const mode = options.mode ?? getCurrentSortMode();
    const entries = Array.from(
      scroller.querySelectorAll("ytmusic-guide-entry-renderer")
    );
    if (entries.length === 0) return;
    const items = [];
    for (const entry of entries) {
      const details = getEntryDetails(entry);
      items.push({
        entry,
        title: details.title,
        playlistId: details.playlistId,
        isPinned: details.isPinned,
        pinnedOrder: details.pinnedOrder
      });
    }
    const sortable = items.filter((item) => !item.isPinned);
    if (mode === "a-z") {
      sortable.sort(
        (a, b) => a.title.localeCompare(b.title, void 0, { numeric: true, sensitivity: "base" })
      );
    } else if (mode === "z-a") {
      sortable.sort(
        (a, b) => b.title.localeCompare(a.title, void 0, { numeric: true, sensitivity: "base" })
      );
    } else if (mode === "recent-played" || mode === "recent-activity") {
      const serverList = options.serverOrderList || (mode === "recent-played" ? cachedPlayedOrder : cachedActivityOrder) || [];
      if (serverList.length === 0) {
        console.warn(
          `[BetterYTM Playlist Sidebar] Cannot sort by "${mode}": server list is empty. Leaving current CSS order.`
        );
        return;
      }
      const idMap = /* @__PURE__ */ new Map();
      const titleMap = /* @__PURE__ */ new Map();
      serverList.forEach((item, idx) => {
        if (item.id && !idMap.has(item.id)) idMap.set(item.id, idx);
        const key = normalizeTitle(item.title);
        if (key && !titleMap.has(key)) titleMap.set(key, idx);
      });
      const rankOf = (item, fallback) => {
        if (item.playlistId && idMap.has(item.playlistId)) return idMap.get(item.playlistId);
        const key = normalizeTitle(item.title);
        if (key && titleMap.has(key)) return titleMap.get(key);
        return 1e4 + fallback;
      };
      let matchedById = 0;
      let matchedByTitle = 0;
      const unmatched = [];
      sortable.forEach((item, idx) => {
        if (item.playlistId && idMap.has(item.playlistId)) matchedById++;
        else if (normalizeTitle(item.title) && titleMap.has(normalizeTitle(item.title))) matchedByTitle++;
        else unmatched.push(`${item.title || "?"} [${item.playlistId ?? "no-id"}]`);
        item.entry.dataset.bytmServerRank = String(rankOf(item, idx));
      });
      sortable.sort((a, b) => {
        const ia = sortable.indexOf(a);
        const ib = sortable.indexOf(b);
        return rankOf(a, ia) - rankOf(b, ib);
      });
      log(
        `Sorted "${mode}": ${matchedById} by id, ${matchedByTitle} by title, ${unmatched.length} unmatched / ${sortable.length} sidebar. Server ${serverList.length}.`
      );
      log(`Sidebar sample:`, sortable.slice(0, 3).map((s) => ({ title: s.title, id: s.playlistId })));
      log(`Server sample:`, serverList.slice(0, 3));
      if (unmatched.length > 0) log(`Unmatched (first 8):`, unmatched.slice(0, 8));
      if (matchedById + matchedByTitle === 0) {
        console.warn(
          "[BetterYTM Playlist Sidebar] Recency join matched 0 sidebar rows. IDs/titles from InnerTube did not line up with the guide. Not alphabetizing."
        );
      }
    }
    for (const item of items) {
      if (item.isPinned) {
        item.entry.style.setProperty("order", String(item.pinnedOrder), "important");
      }
    }
    if (mode === "default") {
      for (const item of sortable) {
        item.entry.style.removeProperty("order");
      }
    } else {
      sortable.forEach((item, index) => {
        item.entry.style.setProperty("order", String(index), "important");
      });
    }
    const input = document.getElementById(FILTER_INPUT_ID);
    if (input == null ? void 0 : input.value) {
      filterPlaylists(scroller, input.value);
    }
    log(
      `Applied playlist sort: mode="${mode}", ${sortable.length} playlists sorted, ${items.length - sortable.length} pinned.`
    );
  }
  function createPlaylistSortObserver(scroller, getOptions) {
    let debounceTimeout = null;
    const observer = new MutationObserver((mutations) => {
      const hasAddedNodes = mutations.some(
        (m) => Array.from(m.addedNodes).some(
          (node) => {
            var _a;
            return node instanceof HTMLElement && (node.tagName.toLowerCase() === "ytmusic-guide-entry-renderer" || ((_a = node.querySelector) == null ? void 0 : _a.call(node, "ytmusic-guide-entry-renderer")));
          }
        )
      );
      if (!hasAddedNodes) return;
      if (debounceTimeout !== null) {
        window.clearTimeout(debounceTimeout);
      }
      debounceTimeout = window.setTimeout(() => {
        debounceTimeout = null;
        applyPlaylistSort({ ...getOptions(), scroller });
      }, 50);
    });
    observer.observe(scroller, { childList: true, subtree: false });
    return observer;
  }
  const SORT_MENU_OPTIONS = [
    { id: "a-z", label: "Alphabetical (A → Z)" },
    { id: "z-a", label: "Inverse Alphabetical (Z → A)" },
    { id: "recent-played", label: "Recently Played" },
    { id: "recent-activity", label: "Recent Activity" },
    { id: "default", label: "Default" }
  ];
  function closeSortDropdown() {
    const dropdown = document.getElementById(DROPDOWN_ID);
    if (dropdown) dropdown.remove();
  }
  function openSortDropdown(anchorBtn) {
    if (document.getElementById(DROPDOWN_ID)) {
      closeSortDropdown();
      return;
    }
    const currentMode = getCurrentSortMode();
    const dropdown = document.createElement("div");
    dropdown.id = DROPDOWN_ID;
    dropdown.setAttribute("role", "menu");
    dropdown.style.position = "fixed";
    dropdown.style.zIndex = "10002";
    dropdown.style.background = "#282828";
    dropdown.style.border = "1px solid rgba(255, 255, 255, 0.15)";
    dropdown.style.borderRadius = "8px";
    dropdown.style.boxShadow = "0 6px 24px rgba(0, 0, 0, 0.7)";
    dropdown.style.padding = "6px 0";
    dropdown.style.minWidth = "220px";
    dropdown.style.fontFamily = 'Roboto, "YouTube Sans", "Noto Sans", sans-serif';
    dropdown.style.color = "#ffffff";
    dropdown.style.backdropFilter = "blur(8px)";
    const rect = anchorBtn.getBoundingClientRect();
    const dropdownWidth = 220;
    let left = rect.right - dropdownWidth;
    if (left < 10) left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 10) {
      left = window.innerWidth - dropdownWidth - 10;
    }
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.left = `${left}px`;
    SORT_MENU_OPTIONS.forEach((opt) => {
      const item = document.createElement("div");
      item.setAttribute("role", "menuitem");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.padding = "8px 14px";
      item.style.cursor = "pointer";
      item.style.fontSize = "13px";
      item.style.gap = "10px";
      item.style.userSelect = "none";
      item.style.transition = "background-color 0.15s ease";
      const checkCont = document.createElement("span");
      checkCont.style.width = "16px";
      checkCont.style.display = "inline-flex";
      checkCont.style.alignItems = "center";
      checkCont.style.justifyContent = "center";
      checkCont.style.flexShrink = "0";
      if (opt.id === currentMode) {
        const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        checkSvg.setAttribute("viewBox", "0 0 24 24");
        checkSvg.setAttribute("width", "16");
        checkSvg.setAttribute("height", "16");
        checkSvg.setAttribute("fill", "currentColor");
        const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        checkPath.setAttribute("d", "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z");
        checkSvg.appendChild(checkPath);
        checkCont.appendChild(checkSvg);
      }
      const labelSpan = document.createElement("span");
      labelSpan.textContent = opt.label;
      labelSpan.style.flex = "1";
      item.appendChild(checkCont);
      item.appendChild(labelSpan);
      item.addEventListener("mouseenter", () => {
        item.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      });
      item.addEventListener("mouseleave", () => {
        item.style.backgroundColor = "transparent";
      });
      item.addEventListener("click", async (evt) => {
        evt.stopPropagation();
        evt.preventDefault();
        log(`Sort option selected: "${opt.id}"`);
        setStoredSortMode(opt.id);
        updateSortButtonTooltip(anchorBtn, opt.id);
        closeSortDropdown();
        if (opt.id === "recent-activity") {
          const orderList = await fetchRecentActivityOrder();
          applyPlaylistSort({ mode: "recent-activity", serverOrderList: orderList });
        } else if (opt.id === "recent-played") {
          const orderList = await fetchRecentlyPlayedOrder();
          applyPlaylistSort({ mode: "recent-played", serverOrderList: orderList });
        } else {
          applyPlaylistSort({ mode: opt.id });
        }
      });
      dropdown.appendChild(item);
    });
    document.body.appendChild(dropdown);
    const onOutsideClick = (evt) => {
      if (!dropdown.contains(evt.target) && !anchorBtn.contains(evt.target)) {
        closeSortDropdown();
        cleanupListeners();
      }
    };
    const onKeyDown = (evt) => {
      if (evt.key === "Escape") {
        closeSortDropdown();
        cleanupListeners();
      }
    };
    const cleanupListeners = () => {
      window.removeEventListener("click", onOutsideClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
    window.addEventListener("click", onOutsideClick, true);
    window.addEventListener("keydown", onKeyDown, true);
  }
  function updateSortButtonTooltip(btn, mode) {
    const currentOpt = SORT_MENU_OPTIONS.find((o) => o.id === mode);
    const label = currentOpt ? currentOpt.label : "Alphabetical (A → Z)";
    btn.title = `Sort playlists (${label})`;
    btn.setAttribute("aria-label", `Sort playlists: ${label}`);
  }
  function createSortButton() {
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.setAttribute("type", "button");
    btn.style.setProperty("width", "26px", "important");
    btn.style.setProperty("height", "26px", "important");
    btn.style.setProperty("min-width", "26px", "important");
    btn.style.setProperty("max-width", "26px", "important");
    btn.style.setProperty("padding", "0", "important");
    btn.style.setProperty("margin", "0", "important");
    btn.style.setProperty("display", "inline-flex", "important");
    btn.style.setProperty("align-items", "center", "important");
    btn.style.setProperty("justify-content", "center", "important");
    btn.style.setProperty("cursor", "pointer", "important");
    btn.style.setProperty("border-radius", "6px", "important");
    btn.style.setProperty("border", "1px solid rgba(255, 255, 255, 0.1)", "important");
    btn.style.setProperty("background-color", "rgba(255, 255, 255, 0.08)", "important");
    btn.style.setProperty("color", "#ffffff", "important");
    btn.style.setProperty("flex", "0 0 26px", "important");
    btn.style.setProperty("box-sizing", "border-box", "important");
    btn.style.setProperty("transition", "background-color 0.2s ease, border-color 0.2s ease", "important");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "currentColor");
    svg.style.display = "block";
    svg.style.pointerEvents = "none";
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z");
    svg.appendChild(path);
    btn.appendChild(svg);
    btn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      evt.preventDefault();
      openSortDropdown(btn);
    });
    updateSortButtonTooltip(btn, getCurrentSortMode());
    return btn;
  }
  let activeScrollerObserver = null;
  let activeObservedScroller = null;
  async function setupSortingForScroller(scroller) {
    const mode = getCurrentSortMode();
    ensureFilterRow(scroller);
    if (mode === "recent-activity") {
      const orderList = await fetchRecentActivityOrder();
      applyPlaylistSort({ scroller, mode, serverOrderList: orderList });
    } else if (mode === "recent-played") {
      const orderList = await fetchRecentlyPlayedOrder();
      applyPlaylistSort({ scroller, mode, serverOrderList: orderList });
    } else {
      applyPlaylistSort({ scroller, mode });
    }
    if (activeObservedScroller !== scroller) {
      activeScrollerObserver == null ? void 0 : activeScrollerObserver.disconnect();
      activeObservedScroller = scroller;
      activeScrollerObserver = createPlaylistSortObserver(scroller, () => ({
        mode: getCurrentSortMode()
      }));
    }
  }
  function tryInjectSortButton() {
    cleanupPrimarySection();
    cleanupNewPlaylistButton();
    const { scroller } = getPlaylistSectionAndScroller();
    if (!scroller) return false;
    ensureFilterRow(scroller);
    setupSortingForScroller(scroller);
    return true;
  }
  function initPlaylistSorter() {
    var _a;
    log("Initializing playlist sorter & filter...");
    const attempt = () => {
      tryInjectSortButton();
    };
    attempt();
    let attempts = 0;
    const pollInterval = window.setInterval(() => {
      attempts++;
      if (tryInjectSortButton() || attempts > 32) {
        window.clearInterval(pollInterval);
      }
    }, 250);
    const rootObserver = new MutationObserver(() => {
      if (!document.getElementById(FILTER_ROW_ID)) {
        tryInjectSortButton();
      }
    });
    const root = document.documentElement || document.body;
    if (root) {
      rootObserver.observe(root, { childList: true, subtree: true });
    }
    if (typeof ((_a = unsafeWindow.BYTM) == null ? void 0 : _a.addSelectorListener) === "function") {
      try {
        unsafeWindow.BYTM.addSelectorListener(
          "sideBar",
          "#contentContainer #guide-content #items ytmusic-guide-entry-renderer",
          {
            listener: () => {
              tryInjectSortButton();
            }
          }
        );
      } catch {
      }
    }
    window.addEventListener("yt-navigate", () => {
      setTimeout(tryInjectSortButton, 100);
    });
  }
  unsafeWindow.addEventListener("bytm:registerPlugin", async (event) => {
    log("bytm:registerPlugin was emitted");
    try {
      await tryRegisterPlugin(event);
      log(`Registered plugin successfully!
Using BetterYTM v${unsafeWindow.BYTM.version}
Plugin build number: ${buildNumber} (${buildMode} mode)`);
    } catch (err) {
      alert("Couldn't register the plugin. Refer to the console for more information.");
      console.error("Couldn't register plugin due to error:", err);
      return;
    }
    try {
      events.once("bytm:ready", () => {
        log("bytm:ready was emitted - initializing the plugin...");
        initPlaylistSorter();
      });
    } catch (err) {
      console.error("A generic error occurred:", err);
    }
  });

})();