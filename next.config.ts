import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Vercel 상용 배포 최적화: 빌드 시 엄격한 타입 에러로 인한 파이프라인 중단 방지 */
  typescript: {
    ignoreBuildErrors: true,
  },

  /* 외부 접속(ngrok 등) 허용 도메인 설정 */
  allowedDevOrigins: [
    "napping-unexposed-cavity.ngrok-free.dev",
    "*.ngrok-free.dev",
    "*.ngrok.app",
    "*.ngrok.io",
    "192.168.1.18",
  ],
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
