import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function moveEntryAssetsToBody(): Plugin {
  return {
    name: "move-entry-assets-to-body",
    enforce: "post",
    transformIndexHtml(html) {
      const styleTags: string[] = [];
      const scriptTags: string[] = [];
      const withoutEntryTags = html
        .replace(/\n\s*<link rel="stylesheet" crossorigin href="\/assets\/[^"]+">/g, (tag) => {
          styleTags.push(tag.trim());
          return "";
        })
        .replace(/\n\s*<script type="module" crossorigin src="\/assets\/[^"]+"><\/script>/g, (tag) => {
          scriptTags.push(tag.trim());
          return "";
        });

      if (styleTags.length === 0 && scriptTags.length === 0) {
        return html;
      }

      return withoutEntryTags.replace(
        "  </body>",
        `    ${scriptTags.join("\n    ")}\n    ${styleTags.join("\n    ")}\n  </body>`
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), moveEntryAssetsToBody()],
  build: {
    target: "es2019"
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@pokertable/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url)
      )
    }
  },
  test: {
    environment: "node"
  }
});
