/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // mammoth is CommonJS with dynamic requires and pdfjs ships a large ESM
  // bundle; both are happier loaded by Node at runtime than bundled.
  experimental: {
    serverComponentsExternalPackages: ["mammoth", "pdfjs-dist"],
  },
};

export default nextConfig;
