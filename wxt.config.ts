import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "SoundCloud Jam",
    description: "Jam with friends on SoundCloud — synchronized listening sessions.",
    permissions: ["tabs", "storage", "alarms"],
    host_permissions: [
      "*://soundcloud.com/*",
      "wss://localhost:*/*",
      "ws://127.0.0.1:*/*",
      "ws://localhost:*/*",
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
