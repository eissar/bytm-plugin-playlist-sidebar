/**
 * @module plugin
 * @description Registers the plugin with BetterYTM's API and provides the plugin definition, events, and token as exports.
 */

import { PluginIntent, type PluginDef, type PluginRegisterResult } from "@bytm/src/types.js";
import pkg from "@root/package.json" with { type: "json" };

// #region pluginDef
/** This object contains all the metadata of your plugin that is used by BetterYTM to display information about your plugin */
export const pluginDef: PluginDef = {
  // The permissions of the plugin:
  intents: [
    PluginIntent.ReadFeatureConfig,
    PluginIntent.CreateModalDialogs,
  ],
  // The metadata of the plugin:
  plugin: {
    name: pkg.userscriptName,
    namespace: pkg.namespace,
    description: {
      "en-US": pkg.description,
    },
    homepage: {
      source: pkg.homepage,
      changelog: pkg.changelogUrl,
      bug: pkg.bugs.url,
    },
    version: pkg.version,
    license: {
      name: pkg.license, // should be a valid SPDX license identifier, or "UNLICENSED" to explicitly state the plugin is "all rights reserved"
      url: pkg.licenseUrl,
    },
    // If you have a logo, you can add it here - it should *ideally* be square and between 48x48 and 128x128.
    // Also make sure it is hosted on a server where CORS is enabled (like the GitHub CDN below), otherwise the browser will block it.
    iconUrl: "https://raw.githubusercontent.com/Sv443/BetterYTM-Plugin-Template/main/assets/plugin_icon_128x128.png",
  },
  // If you have contributors defined in package.json, you can add them here:
  // contributors,
} as const;

/**
 * A [CoreUtils NanoEmitter instance](https://github.com/Sv443-Network/CoreUtils/blob/main/docs.md#class-nanoemitter) that has all events BYTM emits on `window`, plus a few that are intended for all plugins or your plugin specifically.  
 * Check out the `type PluginEventMap` in `bytm/src/types.ts` for a list of all events.
 */
export let events: PluginRegisterResult["events"];
/**
 * A token you can use to identify your plugin in BetterYTM's authenticated function calls, which they will use to recognize your plugin's intents and whether they've been granted by the user.  
 * Do not save this token persistently, as it will be randomly generated each session.
 */
export let token: PluginRegisterResult["token"];

/**
 * Call once after `bytm:registerPlugins` to try to register the plugin.  
 * Resolves as soon as `bytm:pluginsRegistered` was emitted.  
 * Throws if the {@linkcode pluginDef} is wrong.
 */
export async function tryRegisterPlugin(event: WindowEventMap["bytm:registerPlugin"]) {
  const res = event.detail(pluginDef);
  events = res.events;
  token = res.token;

  return await events.once("pluginRegistered");
}
