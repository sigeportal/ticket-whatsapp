import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const backendUrl = env.REACT_APP_BACKEND_URL || 'http://localhost:8080';
  const systemName = env.REACT_APP_NAME_SYSTEM || 'Agilizap';
  const closeHours = env.REACT_APP_HOURS_CLOSE_TICKETS_AUTO || '24';

  return {
    plugins: [
      react({
        include: /\.(jsx|js)$/,
      }),
      {
        name: 'treat-js-files-as-jsx',
        async transform(code, id) {
          if (!id.match(/src\/.*\.js$/)) return null;
          return null;
        },
      },
    ],
    assetsInclude: ['**/*.xlsx', '**/*.mp3', '**/*.ogg', '**/*.wav'],
    define: {
      'process.env.REACT_APP_BACKEND_URL': JSON.stringify(backendUrl),
      'process.env.REACT_APP_NAME_SYSTEM': JSON.stringify(systemName),
      'process.env.REACT_APP_HOURS_CLOSE_TICKETS_AUTO': JSON.stringify(closeHours),
      'process.env.PUBLIC_URL': JSON.stringify(''),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      global: 'window',
      process: 'window.process',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        'mic-recorder-to-mp3': path.resolve(__dirname, './src/helpers/MicRecorder.js'),
        'lamejs': '@breezystack/lamejs',
      },
    },
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },
    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
    },
    build: {
      outDir: 'build',
      sourcemap: false,
      chunkSizeWarningLimit: 4000,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
