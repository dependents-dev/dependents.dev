import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: { format: "preserve" },
  vite: { plugins: [tailwindcss()] },
  redirects: { "/github": "https://github.com/dependents-dev/dependents.dev" },
  site: "https://dependents.dev",
});
