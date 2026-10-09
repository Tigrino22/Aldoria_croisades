import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://aldoria:aldoria@localhost:5433/aldoria_test',
      WORLD_SPEED: '1',
    },
  },
});
