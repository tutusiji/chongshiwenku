const isProductionBuild = process.env.NODE_ENV === "production";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep dev and build outputs separate so running `next build` does not
  // invalidate an active `next dev` server and cause transient 500s.
  distDir: isProductionBuild ? ".next-build" : ".next-dev",
};

export default nextConfig;
