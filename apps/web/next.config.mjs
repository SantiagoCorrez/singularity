/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El navegador habla con la API por el mismo origen: /api/* se reenvía al backend.
  async rewrites() {
    const api = process.env.API_URL ?? 'http://127.0.0.1:8010';
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
