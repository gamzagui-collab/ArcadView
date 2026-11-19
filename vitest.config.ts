import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // dxf-viewer contains extensionless ESM imports. Resolve them through Vite
    // so regression tests exercise the real scene implementation used by APKs.
    server: { deps: { inline: ["dxf-viewer"] } },
  },
}));
