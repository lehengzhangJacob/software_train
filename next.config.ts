import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  // Cloud delivery (ADR-0007): ship a self-contained server bundle built on
  // the dev machine; the server only runs `node server.js` and never builds.
  output: "standalone",
  // next/image optimization needs sharp native binaries per platform; the
  // bundle is traced on Windows but runs on Linux, so serve originals.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
