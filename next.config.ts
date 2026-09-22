import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow ngrok static domains during `next dev` (HMR / assets).
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.app", "*.ngrok.io"],
  transpilePackages: ["better-auth"],
  turbopack: {
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_APP_BUILT_AT: new Date().toISOString(),
  },
};

export default nextConfig;
