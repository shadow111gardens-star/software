import { resolve } from 'node:path';
import { defineConfig } from 'vite';
export default defineConfig({ root: 'src/renderer', base: './', plugins: [{ name: 'production-offline-csp', apply: 'build', transformIndexHtml: html => html.replace("connect-src 'self' ws://127.0.0.1:5173", "connect-src 'none'") }], server: { host: '127.0.0.1', port: 5173, strictPort: true }, build: { outDir: '../../dist/renderer', emptyOutDir: true, rollupOptions: { input: { app: resolve('src/renderer/index.html'), overlay: resolve('src/renderer/overlay/index.html') } } } });
