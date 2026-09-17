import type { InterfaceEvents } from "@bytm/src/interface.ts";
import type { BytmObject } from "@bytm/src/types.js";

declare global {
  interface Window {
    BYTM: BytmObject;
  }

  // Enter BYTM's custom events you need in here so they are available on the `window` object and typed correctly:
  interface WindowEventMap extends Record<string, Event> {
    "bytm:configReady": CustomEvent<InterfaceEvents["bytm:configReady"]>;
    "bytm:lyricsCacheReady": CustomEvent<InterfaceEvents["bytm:lyricsCacheReady"]>;
    "bytm:setLocale": CustomEvent<InterfaceEvents["bytm:setLocale"]>;
    "bytm:preInitPlugin": CustomEvent<InterfaceEvents["bytm:preInitPlugin"]>;
    "bytm:registerPlugin": CustomEvent<InterfaceEvents["bytm:registerPlugin"]>;
    "bytm:observersReady": CustomEvent<InterfaceEvents["bytm:observersReady"]>;
    "bytm:featureInitStarted": CustomEvent<InterfaceEvents["bytm:featureInitStarted"]>;
    "bytm:featureInitialized": CustomEvent<InterfaceEvents["bytm:featureInitialized"]>;
    "bytm:ready": CustomEvent<InterfaceEvents["bytm:ready"]>;
    "bytm:allReady": CustomEvent<InterfaceEvents["bytm:allReady"]>;
    "bytm:fatalError": CustomEvent<InterfaceEvents["bytm:fatalError"]>;
    "bytm:dialogOpened": CustomEvent<InterfaceEvents["bytm:dialogOpened"]>;
    "bytm:dialogOpened:id": CustomEvent<InterfaceEvents["bytm:dialogOpened:id"]>;
    "bytm:dialogClosed": CustomEvent<InterfaceEvents["bytm:dialogClosed"]>;
    "bytm:dialogClosed:id": CustomEvent<InterfaceEvents["bytm:dialogClosed:id"]>;
    "bytm:lyricsLoaded": CustomEvent<InterfaceEvents["bytm:lyricsLoaded"]>;
    "bytm:lyricsCacheCleared": CustomEvent<InterfaceEvents["bytm:lyricsCacheCleared"]>;
    "bytm:lyricsCacheEntryAdded": CustomEvent<InterfaceEvents["bytm:lyricsCacheEntryAdded"]>;
  }
}
