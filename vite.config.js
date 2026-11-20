import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // 相对资源路径，支持本地预览及部署到任意静态子目录。
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src'),
      lib: resolve(projectRoot, 'lib'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
