import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Prioritize API_KEY, fallback to GEMINI_API_KEY
  const apiKey = env.API_KEY || env.GEMINI_API_KEY;

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for the frontend code
      'process.env.API_KEY': JSON.stringify(apiKey),
      // Prevent "process is not defined" errors in libraries or legacy code
      'process.env': {},
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});
