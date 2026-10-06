import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-anuphan",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ลงทะเบียนเข้าร่วมงานบายเนียร์",
  description:
    "ระบบลงทะเบียนเข้าร่วมงานบายเนียร์ด้วยรหัสนักศึกษาหรือ QR code",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${anuphan.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
