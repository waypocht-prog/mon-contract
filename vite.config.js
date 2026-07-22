import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Сборка в ОДИН самодостаточный HTML-файл (весь CSS и JS инлайнятся).
// Это нужно, чтобы готовый dist/index.html можно было опубликовать как артефакт
// или отправить как один файл, без внешних зависимостей.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    target: "es2018",
  },
});
