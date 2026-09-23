import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self' https://*.vnforapps.com https://apisandbox.vnforappstest.com https://static-content-qas.vnforapps.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://static-content.vnforapps.com https://static-content-qas.vnforapps.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.vnforapps.com https://apisandbox.vnforappstest.com",
  "frame-src 'self' blob: https://*.vnforapps.com https://*.s3.us-east-2.amazonaws.com https://s3.us-east-2.amazonaws.com https://apisandbox.vnforappstest.com https://static-content-qas.vnforapps.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    const headers = [
      { key: "Content-Security-Policy", value: contentSecurityPolicy },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
        : []),
    ];
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
