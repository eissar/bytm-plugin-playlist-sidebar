/**
 * @module index
 * @description The entry point of the script.
 */

import { events, tryRegisterPlugin } from "@root/src/plugin.ts";
import { log } from "@utils/logging.js";
import { buildNumber, buildMode } from "@utils/constants.js";
import { initPlaylistSorter } from "@/sort.js";
import "@/types.js";

// #region register plugin

// this is the main entry point of plugins, executed before the DOM is loaded, but after some slightly time consuming initialization tasks have been done by BYTM:
unsafeWindow.addEventListener("bytm:registerPlugin", (event) => {
  log("bytm:registerPlugin was emitted");

  // Register first: in BYTM v3.1.0 `registerPlugin()` runs synchronously inside `tryRegisterPlugin`,
  // which is what assigns the module-level `events` emitter. We intentionally do *not* `await` here
  // before subscribing to `bytm:ready`: `pluginRegistered` (what `tryRegisterPlugin` awaits) is only
  // emitted on a `setTimeout(…, 0)`, whereas `bytm:ready` is emitted synchronously further along
  // BYTM's init flow. Awaiting first would subscribe to `bytm:ready` after it already fired, so the
  // sorter would never initialize.
  const registration = tryRegisterPlugin(event);

  let started = false;
  /** Runs the plugin's runtime code exactly once, regardless of which readiness path wins the race. */
  const start = (reason: string) => {
    if (started) return;
    started = true;
    log(`${reason} - initializing the plugin...`);
    // inject the sidebar filter row + sort button and start observing for changes:
    initPlaylistSorter();
  };

  // Subscribe synchronously right after registering so no `bytm:ready` event can be missed:
  events?.once("bytm:ready", () => start("bytm:ready was emitted"));

  registration
    .then(() => {
      log(`Registered plugin successfully!\nUsing BetterYTM v${unsafeWindow.BYTM.version}\nPlugin build number: ${buildNumber} (${buildMode} mode)`);

      // Safety net: if BYTM v4 makes registration async, `events` may not have existed above and the
      // `bytm:ready` subscription could have been skipped - or the event may already have fired.
      // `BYTM.ready` is a timestamp set when `bytm:ready` is emitted, so fall back to starting now.
      if (!started) {
        if (unsafeWindow.BYTM?.ready) {
          start("BYTM reported it was already ready");
        }
        else {
          events?.once("bytm:ready", () => start("bytm:ready was emitted"));
        }
      }
    })
    .catch((err) => {
      alert("Couldn't register the plugin. Refer to the console for more information.");
      console.error("Couldn't register plugin due to error:", err);
    });
});
