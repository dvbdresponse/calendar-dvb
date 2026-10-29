import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

/** Ship PDF.js fonts and decoders locally, including deployments without a CDN. */
export function pdfAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const folders = ["cmaps", "standard_fonts", "wasm", "iccs"];
  return {
    name: "local-pdf-assets",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith("/pdfjs/")) {
          request.url = request.url.replace(
            "/pdfjs/",
            "/node_modules/pdfjs-dist/",
          );
        }
        next();
      });
    },
    async generateBundle() {
      for (const folder of folders) {
        for (const filename of await readdir(path.join(root, folder))) {
          this.emitFile({
            type: "asset",
            fileName: `pdfjs/${folder}/${filename}`,
            source: await readFile(path.join(root, folder, filename)),
          });
        }
      }
      this.emitFile({
        type: "asset",
        fileName: "pdfjs/LICENSE",
        source: await readFile(path.join(root, "LICENSE")),
      });
    },
  };
}
