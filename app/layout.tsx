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
  title: "SF Mobility | B2B 전세버스 통합 관제 ERP",
  description: "LBS 기반 실시간 배차 및 전세버스 투 트랙 자동 정산 플랫폼",
  // [파비콘(Favicon) 및 앱 아이콘 교체 가이드]
  // 방식 1 (Next.js App Router 파일 컨벤션 - 권장):
  //   - SF 심볼 전용 이미지를 `app/favicon.ico` 또는 `app/icon.png` (권장: 64x64px 이상 정사각형 투명 PNG) 경로에 배치하면
  //     Next.js가 빌드/런타임 시 자동으로 <head> 내 <link rel="icon" ... /> 태그를 생성합니다.
  // 방식 2 (Metadata icons 속성 명시):
  //   - 별도 아이콘 에셋 추가 전까지는 기본 favicon.ico 및 공식 로고를 참조하도록 구성
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/sf_mobility_logo.png", type: "image/png" },
    ],
    apple: [{ url: "/images/sf_mobility_logo.png", type: "image/png" }],
  },
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
