/**
 * Node test preload: `server-only` throws when imported outside Next.js server bundles.
 * Duty intelligence unit tests import `.server.ts` modules directly — stub the guard.
 */
import Module from "node:module";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");

require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

const originalLoad = Module.prototype.load;
Module.prototype.load = function (filename: string, ...rest: unknown[]) {
  if (filename === serverOnlyPath) {
    this.exports = {};
    return;
  }
  return Reflect.apply(originalLoad, this, [filename, ...rest] as Parameters<typeof originalLoad>);
};
