import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://toktickit:toktickit@localhost:5432/queueservice_test",
    },
  },
});
