import { withLogtail } from "@logtail/next";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
      },
    ],
  },
};

// withLogtail is incompatible with static export (next build --output export).
// Skip it in CI / static builds; keep it in local dev for logging.
const isStaticBuild = process.env.CI === "true";

export default isStaticBuild
  ? withMDX(config)
  : withMDX(withLogtail({ ...config }));
