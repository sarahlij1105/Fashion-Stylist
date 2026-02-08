import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prioritize API_KEY, fallback to GEMINI_API_KEY
  const apiKey = env.API_KEY || env.GEMINI_API_KEY || '';

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY specifically.
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Polyfill process.env.SERPAPI_KEY specifically.
      'process.env.SERPAPI_KEY': JSON.stringify(env.SERPAPI_KEY || ''),
      // IMPORTANT: DO NOT define 'process.env': {} as it overrides other env vars and breaks things.
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
    },
  };
});
