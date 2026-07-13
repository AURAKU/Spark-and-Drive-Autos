import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const stubPath = join(dirname(fileURLToPath(import.meta.url)), "empty-module.mjs");
const stubUrl = pathToFileURL(stubPath);

register("server-only-stub", (specifier, context, nextResolve) => {
  if (specifier === "server-only") {
    return {
      url: stubUrl.href,
      format: "module",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
});
