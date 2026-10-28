import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

/**
 * GET /api/admin/drivers/export
 * 관리자용: 기사 고유 UUID 접속 링크 엑셀 생성을 위한 기사 목록 데이터 반환
 */
export async function GET(request: Request) {
  try {
    // 1. 관리자 권한 검증 (NextAuth 세션)
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "인증되지 않은 사용자입니다. 로그인 후 이용해 주세요." },
        { status: 401 }
      );
    }

    // 관리자(ADMIN) 권한 검증 (필요 시 세션 역할 확인)
    const userRole = (session.user as any).role;
    if (userRole && userRole !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "관리자만 접근할 수 있는 API입니다." },
        { status: 403 }
      );
    }

    // 2. 기사(Driver) 목록 조회
    // 멀티테넌시 소속 회사가 있다면 소속 회사 우선 필터링, 없으면 전체 조회
    const drivers = await prisma.driver.findMany({
      select: {
        id: true,
        name: true,
        employmentType: true,
        company: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // 3. 응답 규격 매핑 (phone은 스키마에 추가되기 전까지 기본값 처리)
    const exportData = drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      phone: "-", // 향후 Driver 모델에 phone 컬럼 추가 시 (driver as any).phone 매핑
      companyName: driver.company?.name || "-",
      employmentType: driver.employmentType,
    }));

    return NextResponse.json({
      success: true,
      data: exportData,
      count: exportData.length,
    });
  } catch (error) {
    console.error("[DRIVER_EXPORT_API_ERROR]", error);
    return NextResponse.json(
      { success: false, error: "기사 목록 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
