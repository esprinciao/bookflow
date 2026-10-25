import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `cacheComponents` is deliberately left off. It requires every dynamic read
  // (including the cookie reads Supabase auth depends on) to sit inside a
  // Suspense boundary. For an auth-heavy app that trades a small amount of
  // caching for a much more readable request path. Revisit once the app is
  // feature-complete.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
