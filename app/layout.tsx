import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// [성능/UX 영향]: 모바일 디바이스에서 더블탭 및 핀치 줌에 의한 의도치 않은 뷰포트 확대와 레이아웃 붕괴를 원천 차단
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "스마트투어 ERP - 전세버스 운영 관리 시스템",
  description: "전세버스 배차 스케줄러, 기사별 급여 정산 및 모바일 운행 관리 시스템",
};

import AuthProvider from "./components/AuthProvider";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
