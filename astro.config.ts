import solid from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
  integrations: [solid()],
  vite: { plugins: [tailwindcss()], build: { cssTarget: "safari15" } },
  site: "https://dependents.dev",
});
