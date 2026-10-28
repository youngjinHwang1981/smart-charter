import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

// [보안/성능 영향]: Edge 레벨에서 /admin 접근을 사전 차단하여 미인가 요청의 서버 부하를 방지하고, 정적 자산 제외 matcher로 지연시간 최소화
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const secret = process.env.NEXTAUTH_SECRET || "smart-charter-erp-secret-key-2026-auth";

  // HTTPS(배포) 및 HTTP(로컬) 세션 쿠키 토큰 추출
  const token =
    (await getToken({ req, secret, secureCookie: true })) ||
    (await getToken({ req, secret, secureCookie: false }));

  // 1. 관리자 전용 경로 (/admin, 루트 대시보드, 스케줄러, 정산, 급여) 검증
  const isAdminRoute =
    pathname.startsWith("/admin") ||
    pathname === "/" ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/settlement") ||
    pathname.startsWith("/payroll");

  if (isAdminRoute && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // 2. 기사용 모바일 웹 경로 (/driver/[driverId]):
  // 기사 고유 UUID 토큰 기반 링크이므로 관리자 세션 없이도 접근 허용 (필요 시 별도 토큰 검증 추가 가능)
  if (pathname.startsWith("/driver")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // 정적 리소스(_next/static, _next/image, favicon 등) 및 공용 API를 제외하여 불필요한 미들웨어 오버헤드 차단
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public static assets)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
