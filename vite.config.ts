import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.BACKEND_URL || 'http://127.0.0.1:8080';
  return {
    server: {
      port: Number(env.FRONTEND_PORT || 20555),
      strictPort: true,
      proxy: { '/api': target, '/health': target },
    },
  };
});
