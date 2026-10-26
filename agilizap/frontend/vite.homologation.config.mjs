// Separate build: never reads frontend .env and never replaces the normal build.
import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  envDir: false,
  assetsInclude: ['**/*.xlsx', '**/*.mp3', '**/*.ogg', '**/*.wav'],
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) return null;
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
    react(),
    {
      name: 'homologation-banner',
      transform(code, id) {
        if (id.replaceAll('\\', '/').endsWith('/src/serviceWorker.js')) {
          return 'export function register(){} export function unregister(){}';
        }
      },
      transformIndexHtml(html) {
        return html.replace(
          '<body>',
          '<body><div style="position:fixed;bottom:0;left:0;right:0;background:#fff0bf;color:#533e00;z-index:2147483647;text-align:center;padding:5px;font:13px system-ui">HOMOLOGAÇÃO — dados fictícios, integrações bloqueadas · <a href="/__homologacao" target="_blank">Contas e e-mail de teste</a></div>'
        );
      },
    },
  ],
  define: {
    'process.env.REACT_APP_BACKEND_URL': JSON.stringify('http://homologacao.localhost:18080'),
    'process.env.REACT_APP_NAME_SYSTEM': JSON.stringify('Homologação'),
    'process.env.REACT_APP_HOURS_CLOSE_TICKETS_AUTO': JSON.stringify('24'),
    'process.env.PUBLIC_URL': JSON.stringify(''),
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'window',
    process: 'window.process',
  },
  resolve: {
    alias: {
      '@': path.join(root, 'src'),
      'mic-recorder-to-mp3': path.join(root, 'src/helpers/MicRecorder.js'),
      lamejs: '@breezystack/lamejs',
    },
  },
  build: {
    outDir: path.resolve(root, '../../.security-work/panel/frontend'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
