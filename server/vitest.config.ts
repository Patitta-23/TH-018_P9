import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    test: {
      fileParallelism: false,
      env: {
        DATABASE_URL:
          process.env.TEST_DATABASE_URL ||
          env.TEST_DATABASE_URL ||
          "postgresql://postgres@localhost:5432/queueservice_test",
      },
    },
  };
});
