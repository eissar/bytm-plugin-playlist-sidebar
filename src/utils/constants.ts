/**
 * @module constants
 * @description Exports some build-time constants that are injected via the build process.  
 * To add your own constants, add them to the `ConstTypes` type, the `rawConsts` object, and export them using the `getConst()` function.  
 * Then, search for `replaceStringsPlugin` in `vite.config.ts` to inject the constants into the build.
 */

type ConstTypes = {
  buildMode: "production" | "development";
  buildNumber: string;
};

/** The raw constants that will be replaced by the replaceStringsPlugin in vite.config.ts */
const rawConsts = {
  buildMode: "#{{BUILD_MODE}}",
  buildNumber: "#{{BUILD_NUMBER}}",
} as const satisfies Record<keyof ConstTypes, string>;

/** Returns the value of the given constant, or if the build process failed to inject it, the given default value. */
const getConst = <TKey extends keyof typeof rawConsts, TDefault extends string | number>(constKey: TKey, defaultVal: TDefault) => {
  const val = rawConsts[constKey];
  return (val.match(/^#{{.+}}$/) ? defaultVal : val) as ConstTypes[TKey] | TDefault;
};

/** The build mode (development, production, etc.) */
export const buildMode = getConst("buildMode", "production");

/** The build number (last Git commit's shortened hash) of the current build */
export const buildNumber = getConst("buildNumber", "BUILD_ERROR");
