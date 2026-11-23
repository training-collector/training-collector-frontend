import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['BACKEND_URL', 'FRONTEND_PORT']);
  const target = env.BACKEND_URL || 'http://127.0.0.1:8080';
  const backend = { target, changeOrigin: true };
  return {
    server: {
      port: Number(env.FRONTEND_PORT || 5173),
      proxy: { '/api': backend, '/health': backend },
    },
  };
});
