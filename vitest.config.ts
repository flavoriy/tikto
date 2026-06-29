import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./apps/web/src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: [
        "apps/web/src/lib/**/*.ts",
        "apps/web/src/integrations/services/**/*.ts",
        "packages/shared/src/**/*.ts",
        "packages/contracts/src/**/*.ts",
        "packages/service-runtime/src/**/*.ts",
        "services/*/src/**/*.ts",
      ],
      exclude: [
        "apps/web/src/__tests__/**",
        "**/*.d.ts",
        "apps/web/src/lib/supabase/**/*",
        "apps/web/src/lib/auth/session.ts",
        "apps/web/src/lib/google/calendar-client.ts",
        "apps/web/src/lib/google/tasks-client.ts",
        "apps/web/src/lib/google/oauth.ts",
        "apps/web/src/lib/telegram/bot.ts",
        "apps/web/src/integrations/services/google-import.service.ts",
        "services/*/src/generated/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./apps/web/src"),
      "@shared": path.resolve(__dirname, "./packages/shared/src"),
      "@contracts": path.resolve(__dirname, "./packages/contracts/src"),
      "server-only": path.resolve(__dirname, "./apps/web/src/__tests__/__mocks__/server-only.ts"),
    },
  },
});
