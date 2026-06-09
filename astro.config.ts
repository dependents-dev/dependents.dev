import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  build: { format: "preserve" },
  vite: { plugins: [tailwindcss()] },
  site: "https://dependents.dev",
});
