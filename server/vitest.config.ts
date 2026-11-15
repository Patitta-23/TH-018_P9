import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgresql://postgres@localhost:5432/queueservice_test",
    },
  },
});
