/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**', 'src/services/**', 'backend/src/**'],
      exclude: ['src/core/types.ts', '**/*.test.ts', '**/*.d.ts', 'backend/src/server.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
      },
    },
  },
});
