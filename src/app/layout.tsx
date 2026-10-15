import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FloodTwin AI — Hiểu tình hình trước khi di chuyển",
  description:
    "Bản đồ hỗ trợ theo dõi mưa, đọc phản ánh hiện trường và so sánh lộ trình ở Đồng Nai. Dữ liệu có nguồn, thời điểm và giới hạn rõ ràng.",
  applicationName: "FloodTwin AI",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f7fafc",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Some browser extensions add attributes to <html> before React hydrates.
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
