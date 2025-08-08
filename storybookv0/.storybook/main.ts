// @ts-nocheck
import type { StorybookConfig } from "@storybook/react-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  viteFinal: async (cfg) => {
    cfg.plugins = cfg.plugins || [];
    cfg.plugins.push(tsconfigPaths());
    // Ensure '@/...' resolves to local shims even for files outside root
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.alias = Object.assign({}, cfg.resolve.alias, {
      "@": path.resolve(process.cwd(), "src"),
      "@/utils/apiConfig": path.resolve(process.cwd(), "src/utils/apiConfig.ts"),
      "@/hooks/useAdminCache": path.resolve(process.cwd(), "src/hooks/useAdminCache.ts"),
      "@/lib/utils": path.resolve(process.cwd(), "src/lib/utils.ts"),
      "@/pages/LoginPage": path.resolve(process.cwd(), "src/pages/LoginPage.tsx"),
    });
    // Allow imports from parent workspaces (frontend-lite, legacy frontend)
    cfg.server = cfg.server || {};
    cfg.server.fs = cfg.server.fs || {};
    const allow = new Set<string>(cfg.server.fs.allow || []);
    allow.add(process.cwd());
    allow.add(path.resolve(process.cwd(), ".."));
    allow.add(path.resolve(process.cwd(), "../frontend-lite"));
    allow.add(path.resolve(process.cwd(), "../frontend"));
    cfg.server.fs.allow = Array.from(allow);
    return cfg;
  },
};
export default config;
