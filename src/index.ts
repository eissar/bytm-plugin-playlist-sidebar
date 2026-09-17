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
unsafeWindow.addEventListener("bytm:registerPlugin", async (event) => {
  log("bytm:registerPlugin was emitted");

  try {
    // register the plugin with BetterYTM to be able to call authenticated API functions:
    await tryRegisterPlugin(event);
    log(`Registered plugin successfully!\nUsing BetterYTM v${unsafeWindow.BYTM.version}\nPlugin build number: ${buildNumber} (${buildMode} mode)`);
  }
  catch(err) {
    alert("Couldn't register the plugin. Refer to the console for more information.");
    console.error("Couldn't register plugin due to error:", err);
    return;
  }

  try {
    // this event is emitted when the plugin is fully registered and the DOM is ready, but before most features have finished initializing:
    events.once("bytm:ready", () => {
      log("bytm:ready was emitted - initializing the plugin...");

      // inject the sidebar filter row + sort button and start observing for changes:
      initPlaylistSorter();
    });
  }
  catch(err) {
    console.error("A generic error occurred:", err);
  }
});
