import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    globals: true,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  // NestJS يعتمد على البيانات الوصفية للمزخرِفات (decorators metadata)
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
