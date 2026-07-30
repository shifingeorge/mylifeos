import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. A stray lockfile in a parent directory otherwise
  // makes Turbopack infer the wrong root and warn on every start.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
