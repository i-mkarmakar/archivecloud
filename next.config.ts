import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow ngrok static domains during `next dev` (HMR / assets).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  transpilePackages: ["better-auth"],
  turbopack: {
    root: process.cwd(),
  },
  // Azure publisher-domain check hits this path without the .json suffix.
  async rewrites() {
    return [
      {
        source: "/.well-known/microsoft-identity-association",
        destination: "/.well-known/microsoft-identity-association.json",
      },
    ];
  },
  env: {
    NEXT_PUBLIC_APP_BUILT_AT: new Date().toISOString(),
  },
};

export default nextConfig;
