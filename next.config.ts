import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // อนุญาต dev-server (HMR ฯลฯ) จาก tunnel trycloudflare — โดเมนสุ่มใหม่ทุกครั้ง เลยใช้ wildcard
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
