/**
 * @module index
 * @description The entry point of the script.
 */

import { tryRegisterPlugin } from "@root/src/plugin.ts";
import { log } from "@utils/logging.js";
import { buildNumber, buildMode } from "@utils/constants.js";
import { initPlaylistSorter } from "@/sort.js";
import "@/types.js";

// #region register plugin

/**
 * Resolves once BYTM emits the given window event.  
 * BYTM's `emitInterface()` dispatches every interface event on `unsafeWindow` as a `CustomEvent`,
 * so this works regardless of when the plugin's own event emitter becomes available.
 */
function onceWindowEvent(eventName: keyof WindowEventMap): Promise<void> {
  return new Promise((resolve) => {
    unsafeWindow.addEventListener(eventName, () => resolve(), { once: true });
  });
}

// this is the main entry point of plugins, executed before the DOM is loaded, but after some slightly time consuming initialization tasks have been done by BYTM:
unsafeWindow.addEventListener("bytm:registerPlugin", async (event) => {
  log("bytm:registerPlugin was emitted");

  try {
    // register the plugin with BetterYTM to be able to call authenticated API functions.
    // On BYTM v4 `registerPlugin()` is async (it may await a permissions prompt), so this must be awaited.
    await tryRegisterPlugin(event);
    log(`Registered plugin successfully!\nUsing BetterYTM v${unsafeWindow.BYTM.version}\nPlugin build number: ${buildNumber} (${buildMode} mode)`);
  }
  catch(err) {
    alert("Couldn't register the plugin. Refer to the console for more information.");
    console.error("Couldn't register plugin due to error:", err);
    return;
  }

  try {
    // `bytm:ready` has already fired by this point on BYTM v4 (registration resolves after it), so we
    // wait for `bytm:allReady` instead - it is emitted after all feature entrypoints have initialized
    // and is guaranteed to still be pending here.
    await onceWindowEvent("bytm:allReady");

    log("bytm:allReady was emitted - initializing the plugin...");

    // inject the sidebar filter row + sort button and start observing for changes:
    initPlaylistSorter();
  }
  catch(err) {
    console.error("A generic error occurred:", err);
  }
});
