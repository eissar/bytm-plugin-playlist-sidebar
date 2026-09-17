/**
 * Playlist Sorter & Filter for the YouTube Music sidebar guide.
 * All sort modes (including Recently Played and Recent Activity) are server-backed via InnerTube.
 * Zero local LRU / playback tracking.
 */

import { log } from "@utils/logging.js";

export type SortMode = "a-z" | "z-a" | "recent-played" | "recent-activity" | "default";

export interface ServerPlaylistItem {
  id: string;
  title: string;
}

export interface SortOptions {
  /** The scrollable #items container. If omitted, queries the DOM. */
  scroller?: HTMLElement | null;
  /** Sort order mode. Defaults to "a-z". */
  mode?: SortMode;
  /** Server playlist sequence (from InnerTube fetch). */
  serverOrderList?: ServerPlaylistItem[];
}

const STORAGE_MODE_KEY = "bytm_playlist_sort_mode";
const BUTTON_ID = "bytm-playlist-sort-btn";
const DROPDOWN_ID = "bytm-playlist-sort-dropdown";
const FILTER_ROW_ID = "bytm-playlist-filter-row";
const FILTER_INPUT_ID = "bytm-playlist-filter-input";

/* ========================================================================== */
/* Persistence (Mode only - No local tracking)                                */
/* ========================================================================== */

export function getCurrentSortMode(): SortMode {
  try {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    if (
      saved === "a-z" ||
      saved === "z-a" ||
      saved === "recent-played" ||
      saved === "recent-activity" ||
      saved === "default"
    ) {
      return saved;
    }
  } catch {
    // ignore storage access errors
  }
  return "a-z";
}

export function setStoredSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    // ignore storage access errors
  }
}

/* ========================================================================== */
/* Server-Backed Recency Fetchers (InnerTube API)                             */
/* ========================================================================== */

let cachedActivityOrder: ServerPlaylistItem[] | null = null;
let cachedPlayedOrder: ServerPlaylistItem[] | null = null;
let cachedRecentlyPlayedParam: string | null = null;

function getInnertubeConfig(): { apiKey: string; clientVersion: string; origin: string } {
  const ytcfg =
    (typeof unsafeWindow !== "undefined" && (unsafeWindow as any).ytcfg) ||
    (window as any).ytcfg;

  const apiKey = (ytcfg?.get?.("INNERTUBE_API_KEY") as string) || "";
  const clientVersion =
    (ytcfg?.get?.("INNERTUBE_CLIENT_VERSION") as string) || "2.20250101.00.00";
  const origin = location.origin || "https://music.youtube.com";

  return { apiKey, clientVersion, origin };
}

async function getSapisidHash(origin: string): Promise<string | null> {
  try {
    const match = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]*)/);
    const sapisid = match ? match[1] : null;
    if (!sapisid) return null;
    const now = Math.floor(Date.now() / 1000);
    const buffer = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(`${now} ${sapisid} ${origin}`)
    );
    const hash = Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return `${now}_${hash}`;
  } catch (err) {
    console.warn("[BetterYTM Playlist Sidebar] Error computing SAPISIDHASH:", err);
    return null;
  }
}

async function callInnertubeBrowse(options: {
  browseId?: string;
  params?: string;
  continuation?: string;
}): Promise<unknown | null> {
  const config = getInnertubeConfig();
  if (!config.apiKey) {
    console.error("[BetterYTM Playlist Sidebar] INNERTUBE_API_KEY not found in ytcfg!");
    return null;
  }

  const sapisidHash = await getSapisidHash(config.origin);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Origin": config.origin,
    "X-YouTube-Client-Name": "67",
    "X-YouTube-Client-Version": config.clientVersion,
  };

  if (sapisidHash) {
    headers["Authorization"] = `SAPISIDHASH ${sapisidHash}`;
  } else {
    console.warn("[BetterYTM Playlist Sidebar] No SAPISID cookie found; request may lack authentication.");
  }

  const body: Record<string, unknown> = {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: config.clientVersion,
        hl: "en",
        gl: "US",
      },
    },
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
      body: JSON.stringify(body),
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

function normalizePlaylistId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let id = raw.trim();
  try {
    id = decodeURIComponent(id);
  } catch {
    // keep raw
  }
  if (id.startsWith("VL")) id = id.slice(2);
  if (!id || id.startsWith("FE") || id.startsWith("UC") || id.startsWith("MP")) return null;
  return id;
}

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function jsonText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const rec = node as Record<string, unknown>;
  if (typeof rec.simpleText === "string") return rec.simpleText;
  if (typeof rec.content === "string") return rec.content;
  if (Array.isArray(rec.runs)) {
    return rec.runs
      .map((run) => (run && typeof run === "object" && typeof (run as { text?: string }).text === "string" ? (run as { text: string }).text : ""))
      .join("");
  }
  return "";
}

function extractPlaylistIdFromHref(href: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, location.origin);
    const fromQuery = normalizePlaylistId(url.searchParams.get("list"));
    if (fromQuery) return fromQuery;
    const browse = url.pathname.match(/\/browse\/([^/]+)/);
    if (browse) return normalizePlaylistId(browse[1]);
  } catch {
    // fall through to regex
  }
  const listMatch = href.match(/[?&]list=([^&]+)/);
  if (listMatch) return normalizePlaylistId(listMatch[1]);
  const browseMatch = href.match(/browse\/(VL[^/?&]+)/);
  if (browseMatch) return normalizePlaylistId(browseMatch[1]);
  return null;
}

const SKIP_JSON_KEYS = new Set([
  "menu",
  "menuRenderer",
  "menuNavigationItemRenderer",
  "menuServiceItemRenderer",
  "toggleMenuServiceItemRenderer",
  "contextMenu",
  "overlay",
  "loggingContext",
  "clickTrackingParams",
  "trackingParams",
]);

function extractServerPlaylists(json: unknown): ServerPlaylistItem[] {
  if (!json || typeof json !== "object") {
    console.warn("[BetterYTM Playlist Sidebar] extractServerPlaylists: response is not an object", json);
    return [];
  }

  const list: ServerPlaylistItem[] = [];
  const seen = new Set<string>();

  const consider = (rawId: unknown, title: string) => {
    if (typeof rawId !== "string") return;
    const id = normalizePlaylistId(rawId);
    if (!id || id === "LM" || id === "SE" || seen.has(id)) return;
    seen.add(id);
    list.push({ id, title: title.trim() });
  };

  const walk = (node: unknown, inheritedTitle: string, depth: number) => {
    if (!node || typeof node !== "object" || depth > 40) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inheritedTitle, depth + 1);
      return;
    }

    const rec = node as Record<string, unknown>;
    const title =
      jsonText(rec.title) ||
      jsonText(rec.formattedTitle) ||
      jsonText(rec.text) ||
      jsonText((rec.accessibility as any)?.accessibilityData?.label) ||
      inheritedTitle;

    consider(rec.browseId, title);
    consider(rec.playlistId, title);
    consider((rec.browseEndpoint as { browseId?: string } | undefined)?.browseId, title);
    consider((rec.watchPlaylistEndpoint as { playlistId?: string } | undefined)?.playlistId, title);
    consider((rec.watchEndpoint as { playlistId?: string } | undefined)?.playlistId, title);

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

function extractLibrarySortParams(json: unknown): { activity?: string; played?: string } {
  const found: { activity?: string; played?: string } = {};

  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || depth > 30) return;
    const rec = node as Record<string, unknown>;
    const renderer =
      rec.dropdownItemRenderer || rec.chipCloudChipRenderer || rec.sortFilterSubMenuItemRenderer;

    if (renderer && typeof renderer === "object") {
      const item = renderer as Record<string, unknown>;
      const label = (
        jsonText(item.label) ||
        jsonText(item.title) ||
        jsonText(item.text) ||
        jsonText((item.accessibility as any)?.accessibilityData?.label)
      )
        .toLowerCase()
        .trim();
      const params =
        (item.navigationEndpoint as any)?.browseEndpoint?.params ||
        (item.onSelectCommand as any)?.browseEndpoint?.params ||
        (item.command as any)?.browseEndpoint?.params ||
        (item.chipEndpoint as any)?.browseEndpoint?.params;
      if (label && typeof params === "string") {
        if (!found.played && label.includes("recently played")) {
          found.played = params;
          log(`Library sort "Recently played" params from label "${label}"`);
        } else if (
          !found.activity &&
          (label === "recents" || label.includes("recent activity")) &&
          !label.includes("played")
        ) {
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

function extractContinuationToken(json: unknown): string | null {
  let token: string | null = null;

  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== "object" || token || depth > 30) return;
    const rec = node as Record<string, unknown>;

    if (rec.continuationItemRenderer) {
      const cir = rec.continuationItemRenderer as any;
      const found =
        cir.continuationEndpoint?.continuationCommand?.token ||
        cir.button?.buttonRenderer?.command?.continuationCommand?.token;
      if (typeof found === "string" && found) {
        token = found;
        return;
      }
    }

    if (rec.nextContinuationData) {
      const found = (rec.nextContinuationData as { continuation?: string }).continuation;
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

async function fetchAllBrowsePlaylists(
  browseId: string,
  params?: string
): Promise<{ items: ServerPlaylistItem[]; firstPage: unknown | null }> {
  const all: ServerPlaylistItem[] = [];
  const seenIds = new Set<string>();
  const seenTokens = new Set<string>();
  let continuation: string | undefined;
  let firstPage: unknown | null = null;
  let page = 0;

  while (page < 20) {
    page++;
    const json = continuation
      ? await callInnertubeBrowse({ continuation })
      : await callInnertubeBrowse({ browseId, params });
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

/**
 * 2. Recent Activity: Fetches the native Library Playlists response from InnerTube.
 * By default, YouTube Music orders this shelf by Recent Activity.
 */
async function fetchRecentActivityOrder(): Promise<ServerPlaylistItem[]> {
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

/**
 * Recently Played: same library browse as Recents, with YouTube's "Recently played" sort params.
 * No Home-feed fallback — that mix is songs, not the sidebar playlist list.
 */
async function fetchRecentlyPlayedOrder(): Promise<ServerPlaylistItem[]> {
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

/* ========================================================================== */
/* DOM & Invariant Resolvers                                                  */
/* ========================================================================== */

function cleanupPrimarySection() {
  const primarySection = document.querySelector<HTMLElement>(
    "ytmusic-guide-section-renderer[is-primary] #items"
  );
  if (primarySection) {
    primarySection.style.removeProperty("display");
    primarySection.style.removeProperty("flex-direction");
    primarySection.querySelectorAll<HTMLElement>("ytmusic-guide-entry-renderer").forEach((el) => {
      el.style.removeProperty("order");
    });
  }
}

function cleanupNewPlaylistButton() {
  const newPlaylistBtn = findNewPlaylistButton();
  if (newPlaylistBtn) {
    const anchor = newPlaylistBtn.closest<HTMLElement>("yt-button-shape") ?? newPlaylistBtn;
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

/**
 * Finds the playlist section and its #items scroller in the real YouTube Music DOM.
 * Grounded in the invariant that "Liked Music" (LM) is a child of the playlist container.
 */
export function getPlaylistSectionAndScroller(): {
  section: HTMLElement | null;
  scroller: HTMLElement | null;
} {
  // Method 1: Component containment from our filter row / sort button
  const filterRow = document.getElementById(FILTER_ROW_ID);
  if (filterRow) {
    const scroller = filterRow.closest<HTMLElement>("#items");
    const section = filterRow.closest<HTMLElement>("ytmusic-guide-section-renderer");
    if (scroller) return { section, scroller };
  }

  // Method 2: Core Invariant: "Liked Music" (LM) is uniquely and exclusively a child of the playlist #items
  const lmEntry =
    document.querySelector<HTMLElement>('#guide a[href*="list=LM"]') ||
    document.querySelector<HTMLElement>('#guide a[href*="VLLM"]') ||
    Array.from(document.querySelectorAll<HTMLElement>('#guide ytmusic-guide-entry-renderer')).find((el) => {
      const title = el.querySelector<HTMLElement>(".title-group .title, .title")?.textContent?.trim().toLowerCase();
      return title === "liked music";
    });

  if (lmEntry) {
    const scroller = lmEntry.closest<HTMLElement>("#items");
    const section = lmEntry.closest<HTMLElement>("ytmusic-guide-section-renderer");
    if (scroller) return { section, scroller };
  }

  // Method 3: Co-located with the "New playlist" action button in Section 2
  const newPlaylistBtn = findNewPlaylistButton();
  if (newPlaylistBtn) {
    const section = newPlaylistBtn.closest<HTMLElement>("ytmusic-guide-section-renderer");
    const scroller = section?.querySelector<HTMLElement>("#items") ?? null;
    if (scroller) return { section, scroller };
  }

  return { section: null, scroller: null };
}

export function findNewPlaylistButton(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#guide button[aria-label="New playlist"]') ||
    document.querySelector<HTMLElement>('#guide-content ytmusic-guide-section-renderer button.ytSpecButtonShapeNextHost') ||
    document.querySelector<HTMLElement>('#guide-content yt-button-shape button') ||
    document.querySelector<HTMLElement>('#guide a[href*="create_playlist"]') ||
    null
  );
}

function getEntryDetails(entry: HTMLElement): {
  title: string;
  playlistId: string | null;
  isPinned: boolean;
  pinnedOrder: number;
} {
  const polymer = entry as unknown as {
    data?: {
      formattedTitle?: { runs?: Array<{ text: string }> };
      title?: { runs?: Array<{ text: string }>; simpleText?: string };
      navigationEndpoint?: {
        browseEndpoint?: { browseId?: string };
        createPlaylistEndpoint?: unknown;
      };
    };
    __data?: {
      formattedTitle?: { runs?: Array<{ text: string }> };
      title?: { runs?: Array<{ text: string }>; simpleText?: string };
      navigationEndpoint?: {
        browseEndpoint?: { browseId?: string };
        createPlaylistEndpoint?: unknown;
      };
    };
  };

  const data = polymer.data || polymer.__data;

  let title =
    data?.formattedTitle?.runs?.[0]?.text ||
    data?.title?.runs?.[0]?.text ||
    data?.title?.simpleText ||
    "";

  const browseId = data?.navigationEndpoint?.browseEndpoint?.browseId || "";
  let playlistId = browseId.startsWith("VL") ? browseId.substring(2) : browseId || null;

  if (!title) {
    const root = entry.shadowRoot ?? entry;
    const titleEl =
      entry.querySelector<HTMLElement>("yt-formatted-string.title, .title-group yt-formatted-string, .title") ||
      root.querySelector<HTMLElement>("yt-formatted-string.title, .title-group yt-formatted-string, .title");
    title = titleEl?.textContent?.trim() || "";
  }
  if (!title) {
    title = (entry.textContent || "").replace(/\s+/g, " ").trim();
  }

  if (!playlistId) {
    const anchors: HTMLAnchorElement[] = [];
    const collectAnchors = (root: Element | ShadowRoot) => {
      root.querySelectorAll("a").forEach((a) => anchors.push(a as HTMLAnchorElement));
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

  const isCreateAction =
    Boolean(data?.navigationEndpoint?.createPlaylistEndpoint) ||
    entry.classList.contains("guide-entry-renderer-pinned");

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

/* ========================================================================== */
/* DOM Filtering & Unified Row                                                */
/* Visual order is CSS `order` only. Playlist nodes are never moved.          */
/* ========================================================================== */

function ensureFilterStyles() {
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
  document.head?.appendChild(style);
}

export function filterPlaylists(scroller: HTMLElement, query: string): void {
  const cleanQuery = query.trim().toLowerCase();
  const entries = scroller.querySelectorAll<HTMLElement>("ytmusic-guide-entry-renderer");

  entries.forEach((entry) => {
    if (!cleanQuery) {
      entry.classList.remove("bytm-playlist-filtered-out");
      return;
    }
    const details = getEntryDetails(entry);
    const haystack = `${details.title} ${details.playlistId ?? ""} ${(entry.textContent || "").replace(/\s+/g, " ")}`
      .toLowerCase();
    entry.classList.toggle("bytm-playlist-filtered-out", !haystack.includes(cleanQuery));
  });
}

function createFilterRow(scroller: HTMLElement): HTMLElement {
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

  // Left: Search input wrapper taking ~80-85% (4:1 to 5:1 ratio)
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

  // Search glass icon SVG
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

  // Input element
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

  // Clear button (×)
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

  // Hotkey isolation
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

  // Right: Sort playlists button inside the filter row
  const sortBtn = createSortButton();
  row.appendChild(sortBtn);

  return row;
}

function ensureScrollerFlex(scroller: HTMLElement): void {
  scroller.style.setProperty("display", "flex", "important");
  scroller.style.setProperty("flex-direction", "column", "important");
}

function ensureFilterRow(scroller: HTMLElement): void {
  ensureScrollerFlex(scroller);

  const existingRow = document.getElementById(FILTER_ROW_ID);
  if (existingRow && scroller.contains(existingRow)) {
    existingRow.style.setProperty("order", "-1000", "important");
    if (!existingRow.querySelector(`#${BUTTON_ID}`)) {
      existingRow.appendChild(createSortButton());
    }
    return;
  }

  // Never prepend or relocate playlist nodes. Append chrome at the end and pin it
  // visually with CSS order so Polymer child indices stay intact.
  if (existingRow) {
    existingRow.style.setProperty("order", "-1000", "important");
    return;
  }

  const filterRow = createFilterRow(scroller);
  scroller.appendChild(filterRow);
}

/* ========================================================================== */
/* Core Sort Implementation                                                   */
/* ========================================================================== */

export function applyPlaylistSort(options: SortOptions = {}): void {
  cleanupPrimarySection();
  cleanupNewPlaylistButton();

  const scroller = options.scroller ?? getPlaylistSectionAndScroller().scroller;
  if (!scroller) return;

  ensureFilterRow(scroller);
  ensureScrollerFlex(scroller);

  const mode = options.mode ?? getCurrentSortMode();

  const entries = Array.from(
    scroller.querySelectorAll<HTMLElement>("ytmusic-guide-entry-renderer")
  );

  if (entries.length === 0) return;

  interface EntryMeta {
    entry: HTMLElement;
    title: string;
    playlistId: string | null;
    isPinned: boolean;
    pinnedOrder: number;
  }

  const items: EntryMeta[] = [];

  for (const entry of entries) {
    const details = getEntryDetails(entry);
    items.push({
      entry,
      title: details.title,
      playlistId: details.playlistId,
      isPinned: details.isPinned,
      pinnedOrder: details.pinnedOrder,
    });
  }

  const sortable = items.filter((item) => !item.isPinned);

  if (mode === "a-z") {
    sortable.sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" })
    );
  } else if (mode === "z-a") {
    sortable.sort((a, b) =>
      b.title.localeCompare(a.title, undefined, { numeric: true, sensitivity: "base" })
    );
  } else if (mode === "recent-played" || mode === "recent-activity") {
    const serverList: ServerPlaylistItem[] =
      options.serverOrderList ||
      (mode === "recent-played" ? cachedPlayedOrder : cachedActivityOrder) ||
      [];

    if (serverList.length === 0) {
      console.warn(
        `[BetterYTM Playlist Sidebar] Cannot sort by "${mode}": server list is empty. Leaving current CSS order.`
      );
      return;
    }

    const idMap = new Map<string, number>();
    const titleMap = new Map<string, number>();
    serverList.forEach((item, idx) => {
      if (item.id && !idMap.has(item.id)) idMap.set(item.id, idx);
      const key = normalizeTitle(item.title);
      if (key && !titleMap.has(key)) titleMap.set(key, idx);
    });

    const rankOf = (item: (typeof sortable)[number], fallback: number): number => {
      if (item.playlistId && idMap.has(item.playlistId)) return idMap.get(item.playlistId)!;
      const key = normalizeTitle(item.title);
      if (key && titleMap.has(key)) return titleMap.get(key)!;
      return 10_000 + fallback;
    };

    let matchedById = 0;
    let matchedByTitle = 0;
    const unmatched: string[] = [];

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

  // Visual layout only. Playlist nodes stay where Polymer stamped them.
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

  const input = document.getElementById(FILTER_INPUT_ID) as HTMLInputElement | null;
  if (input?.value) {
    filterPlaylists(scroller, input.value);
  }

  log(
    `Applied playlist sort: mode="${mode}", ${sortable.length} playlists sorted, ${items.length - sortable.length} pinned.`
  );
}

export function createPlaylistSortObserver(
  scroller: HTMLElement,
  getOptions: () => SortOptions
): MutationObserver {
  let debounceTimeout: number | null = null;

  const observer = new MutationObserver((mutations) => {
    const hasAddedNodes = mutations.some((m) =>
      Array.from(m.addedNodes).some(
        (node) =>
          node instanceof HTMLElement &&
          (node.tagName.toLowerCase() === "ytmusic-guide-entry-renderer" ||
            node.querySelector?.("ytmusic-guide-entry-renderer"))
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

/* ========================================================================== */
/* UI: Sort Button & Dropdown Menu                                            */
/* ========================================================================== */

interface SortMenuOption {
  id: SortMode;
  label: string;
}

const SORT_MENU_OPTIONS: SortMenuOption[] = [
  { id: "a-z", label: "Alphabetical (A → Z)" },
  { id: "z-a", label: "Inverse Alphabetical (Z → A)" },
  { id: "recent-played", label: "Recently Played" },
  { id: "recent-activity", label: "Recent Activity" },
  { id: "default", label: "Default" },
];

function closeSortDropdown() {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (dropdown) dropdown.remove();
}

function openSortDropdown(anchorBtn: HTMLElement) {
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

  const onOutsideClick = (evt: MouseEvent) => {
    if (!dropdown.contains(evt.target as Node) && !anchorBtn.contains(evt.target as Node)) {
      closeSortDropdown();
      cleanupListeners();
    }
  };

  const onKeyDown = (evt: KeyboardEvent) => {
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

function updateSortButtonTooltip(btn: HTMLElement, mode: SortMode) {
  const currentOpt = SORT_MENU_OPTIONS.find((o) => o.id === mode);
  const label = currentOpt ? currentOpt.label : "Alphabetical (A → Z)";
  btn.title = `Sort playlists (${label})`;
  btn.setAttribute("aria-label", `Sort playlists: ${label}`);
}

function createSortButton(): HTMLButtonElement {
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

/* ========================================================================== */
/* Initializer & Observers                                                    */
/* ========================================================================== */

let activeScrollerObserver: MutationObserver | null = null;
let activeObservedScroller: HTMLElement | null = null;

async function setupSortingForScroller(scroller: HTMLElement) {
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
    activeScrollerObserver?.disconnect();
    activeObservedScroller = scroller;
    activeScrollerObserver = createPlaylistSortObserver(scroller, () => ({
      mode: getCurrentSortMode(),
    }));
  }
}

export function tryInjectSortButton(): boolean {
  cleanupPrimarySection();
  cleanupNewPlaylistButton();

  const { scroller } = getPlaylistSectionAndScroller();
  if (!scroller) return false;

  ensureFilterRow(scroller);
  setupSortingForScroller(scroller);
  return true;
}

export function initPlaylistSorter() {
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

  if (typeof unsafeWindow.BYTM?.addSelectorListener === "function") {
    try {
      unsafeWindow.BYTM.addSelectorListener(
        "sideBar",
        "#contentContainer #guide-content #items ytmusic-guide-entry-renderer",
        {
          listener: () => {
            tryInjectSortButton();
          },
        }
      );
    } catch {
      // ignore
    }
  }

  window.addEventListener("yt-navigate", () => {
    setTimeout(tryInjectSortButton, 100);
  });
}
