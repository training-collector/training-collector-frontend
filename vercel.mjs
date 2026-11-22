const value = process.env.BACKEND_URL;
const backend = value && URL.canParse(value) ? new URL(value) : null;
if (!backend || backend.protocol !== 'https:' || backend.username || backend.password ||
    backend.pathname !== '/' || backend.search || backend.hash) {
  throw new Error('Set BACKEND_URL to the HTTPS origin of the backend, e.g. https://api.example.com');
}

export const config = {
  framework: 'vite',
  rewrites: [
    { source: '/api/v1/:path*', destination: `${backend.origin}/api/v1/:path*` },
    { source: '/health', destination: `${backend.origin}/health` },
  ],
};
