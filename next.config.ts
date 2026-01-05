import type { NextConfig } from "next";
import { baseURL } from "./baseUrl";

const nextConfig: NextConfig = {
  assetPrefix: baseURL,
  allowedOrigins: ["nextjs-org.web-sandbox.oaiusercontent.com"],
};

export default nextConfig;
