/**
 * 과거 수기 엑셀 데이터 DB 일괄 적재 및 클린업 마이그레이션 스크립트 (정밀 정제 버전)
 * 
 * 대상 파일:
 *   1. '월정산 - 2607 (0626-0725).xlsx' (일자별 배차 시트 포맷)
 *   2. '기간별 - 2026 설하.xlsx' (차량별 근무/정산 시트 포맷)
 * 
 * 주요 정제 기능:
 *   - 소수점 시간값(0.2638...), 운행횟수 숫자(96, 60 등), 정산 계정명 노이즈 원천 차단
 *   - 기사명에 유입되던 날짜/계정과목/상호명 원천 차단 (한글 2~4자 인명 정밀 필터링)
 *   - 번호판 4자리 정규화 (상호명 차량 배제)
 *   - 과거 수기 데이터 일괄 정제 재적재
 * 
 * 실행:
 *   npx tsx prisma/import-history.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// 설정 및 파일 경로 탐색
// ─────────────────────────────────────────────────────────────
const TARGET_FILES = [
  '월정산 - 2607 (0626-0725).xlsx',
  '기간별 - 2026 설하.xlsx',
];

function resolveFilePath(fileName: string): string | null {
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '참고자료'),
    path.resolve(process.cwd(), '../참고자료'),
    path.resolve(process.cwd(), '../../참고자료'),
    'e:/project/여행사_ERP/참고자료',
  ];

  for (const dir of candidateDirs) {
    const fullPath = path.join(dir, fileName);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 파싱 데이터 인터페이스
// ─────────────────────────────────────────────────────────────
interface ParsedHistoryRecord {
  sourceFile: string;
  sheetName: string;
  rowNumber: number;
  date: Date; // UTC 자정 기준
  routeName: string;
  clientName: string;
  driverName: string | null;
  plateNumber: string | null;
  dispatchType: 'FIXED' | 'NORMAL';
}

interface MigrationStats {
  file: string;
  totalParsed: number;
  successCount: number;
  failCount: number;
  newRoutes: number;
  newDrivers: number;
  newVehicles: number;
}

// ─────────────────────────────────────────────────────────────
// 정밀 데이터 정제(Data Cleansing) 필터 규칙
// ─────────────────────────────────────────────────────────────
const norm = (v: unknown): string => String(v ?? '').replace(/\s+/g, '');
const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v).trim());

/** 기사명에 들어올 수 없는 예약어 및 비인명 단어 목록 */
const INVALID_DRIVER_WORDS = new Set([
  '계정과목', '날짜', '일자', '승무원', '기사', '기사명', '성명', '합계', '소계', '구분', '차량', '차량번호',
  '교대제', 'k5셔틀', 'k4광주', 'k3셔틀', 'ot', '오피스', '오피스통근', '오피스 통근', '셔틀', '일반', '학원',
  '유가연동제', '유류지원', '고객지원', '보훈관광', '삼진운수', '서울구경', '아름', '아름다운관광', '오륙도여행',
  '현대관광', '거산', '외부차량', '운행노선', '비고', '출금액', '입금액', '적요'
]);

/** 실제 기사 이름인지 정밀 검증 (한국인 인명 한글 2~4자) */
function isValidDriverName(name: unknown): boolean {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 5) return false;
  if (/^\d+/.test(clean)) return false; // 숫자나 날짜
  if (/[\/~년월일\-:]/.test(clean)) return false; // 날짜 기호
  if (INVALID_DRIVER_WORDS.has(clean.toLowerCase()) || INVALID_DRIVER_WORDS.has(clean.replace(/\s+/g, '').toLowerCase())) {
    return false;
  }
  // 한글 2~4글자 이름만 통과 (예: 오이섭, 박광열, 남상운 등)
  return /^[가-힣]{2,4}$/.test(clean);
}

/** 노선명 정밀 검증 (시간 소수점, 단순 숫자 카운트, 정산 계정명 배제) */
function isValidRouteName(name: unknown): boolean {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (clean.length < 2) return false;
  // 순수 숫자 또는 시간 분수 소수점 (예: 0.26388..., 96, 60, 1 등) 배제
  if (/^\d+(\.\d+)?$/.test(clean)) return false;
  // 비배차 항목 및 정산 계정명 배제
  if (/^(합계|소계|소 계|당 월 소 계|운행\s*노선|운행구간|품목|no|유류지원|유가연동제|잔액|정산금|비고)$/i.test(clean)) {
    return false;
  }
  if (/정산금\s*잔액|유가연동제|할부|보험료|주유비|요소수|통행료|주차비/.test(clean)) {
    return false;
  }
  return true;
}

/** 4자리 차량 번호판 추출 (상호명 및 무효값 배제) */
function cleanPlateNumber(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\*/g, '').trim();
  if (!s || s === '0' || s === 'null') return null;

  // 번호판에서 4자리 숫자 추출 (예: '경기78자7246' -> '7246', '3590' -> '3590')
  const match = s.match(/\d{4}/);
  if (match) return match[0];
  return null;
}

/** 운행구간 앞의 시각 문자열 '(04:18)', '09:10' 등 제거 및 화살표 통일 */
function cleanRouteName(val: unknown): string {
  const s = text(val);
  return s.replace(/^\(?\s*\d{1,2}:\d{2}\s*\)?\s*/, '').replace(/→/g, ' - ').replace(/\s*-\s*/g, ' - ').trim();
}

/** 엑셀 시리얼 넘버 / 문자열 날짜 -> UTC 자정 Date 변환 */
function parseExcelDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;

  // 숫자형 엑셀 시리얼 (예: 46199 -> 2026-06-26)
  if (typeof val === 'number') {
    if (val >= 30000 && val <= 65000) {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 0, 0, 0));
    }
    return null;
  }

  const str = String(val).trim();

  // YYYY-MM-DD
  const m1 = str.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m1) return new Date(Date.UTC(+m1[1], +m1[2] - 1, +m1[3], 0, 0, 0));

  // YY/M/D
  const m2 = str.match(/(\d{2})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m2) return new Date(Date.UTC(2000 + parseInt(m2[1], 10), +m2[2] - 1, +m2[3], 0, 0, 0));

  // 기간 형식 (예: "26/1/1~26/1/31" 또는 "25/12/26~26/1/25") -> 시작일 기준 산출
  const mRange = str.match(/(\d{2})[-./](\d{1,2})[-./](\d{1,2})\s*~/);
  if (mRange) return new Date(Date.UTC(2000 + parseInt(mRange[1], 10), +mRange[2] - 1, +mRange[3], 0, 0, 0));

  return null;
}

// ─────────────────────────────────────────────────────────────
// 파서 1: '월정산 - 2607 (0626-0725).xlsx' 정밀 파싱
// ─────────────────────────────────────────────────────────────
function parseMonthlySettlementFile(filePath: string): ParsedHistoryRecord[] {
  console.log(`\n📖 [파일 1 정밀 파싱] ${path.basename(filePath)}`);
  const wb = XLSX.readFile(filePath);
  const records: ParsedHistoryRecord[] = [];

  const daySheetNames = wb.SheetNames.filter((name) => {
    const clean = name.trim();
    return /^\d{1,2}$/.test(clean) || /^7-\d{1,2}$/.test(clean) || clean === '6-25';
  });

  console.log(`  🔍 대상 일자별 시트: ${daySheetNames.length}개 발견`);

  for (const sheetName of daySheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    if (!rows || rows.length < 5) continue;

    // 헤더 행 및 컬럼 인덱스 탐색
    let headerRowIdx = -1;
    let colClient = 3;
    let colCategory = 4;
    let colLabel = 5;      // 호차 또는 시간
    let colRoutePath = 6;  // 실제 운행 구간 (출발지)
    let colPlate = 8;      // 차량번호
    let colDriver = 9;     // 승무원

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
      const row = (rows[r] ?? []).map(norm);
      const pIdx = row.findIndex((c) => c.includes('차량번호') || c === '차량');
      const dIdx = row.findIndex((c) => c.includes('승무원') || c.includes('기사'));

      if (pIdx !== -1 && dIdx !== -1) {
        headerRowIdx = r;
        colPlate = pIdx;
        colDriver = dIdx;

        row.forEach((cell, c) => {
          if (cell.includes('거래처') || cell.includes('발주처')) colClient = c;
          if (cell.includes('운행구분') || cell.includes('구분')) colCategory = c;
          if (cell.includes('출발지') || cell.includes('운행구간')) colRoutePath = c;
          if (cell.includes('노선및시간') || cell.includes('호차')) colLabel = c;
        });
        break;
      }
    }

    if (headerRowIdx === -1) continue;

    // 날짜 탐색
    let sheetDate: Date | null = null;
    for (let r = 0; r < headerRowIdx; r++) {
      for (const cell of rows[r] ?? []) {
        const d = parseExcelDate(cell);
        if (d) {
          sheetDate = d;
          break;
        }
      }
      if (sheetDate) break;
    }

    if (!sheetDate) {
      const dayNum = parseInt(sheetName.replace('7-', ''), 10);
      if (!isNaN(dayNum)) {
        const month = sheetName.startsWith('7-') || dayNum <= 25 ? 7 : 6;
        sheetDate = new Date(Date.UTC(2026, month - 1, dayNum, 0, 0, 0));
      }
    }

    if (!sheetDate) continue;

    // 데이터 행 순회 파싱
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const client = colClient !== -1 && row[colClient] ? text(row[colClient]) : '앰코';
      const category = colCategory !== -1 && row[colCategory] ? text(row[colCategory]) : '';
      const rawPath = colRoutePath !== -1 ? text(row[colRoutePath]) : '';
      const rawLabel = colLabel !== -1 ? text(row[colLabel]) : '';
      const rawDriver = colDriver !== -1 ? text(row[colDriver]) : '';
      const rawPlate = colPlate !== -1 ? text(row[colPlate]) : '';

      // 빈 행 및 합계 행 제외
      if (!rawPath && !rawDriver && !rawPlate) continue;
      if (category.includes('합계') || rawPath.includes('합계') || rawLabel.includes('합계')) continue;

      // ── 노선명 정밀 조합 ──
      // col 6 (출발지/운행구간)이 실제 노선 텍스트임
      let routeName = cleanRouteName(rawPath);

      // col 5가 호차 형태의 문자열("1호차", "2호차", "OT1" 등)이고 숫자가 아니라면 결합
      if (rawLabel && !/^\d+(\.\d+)?$/.test(rawLabel.trim())) {
        const cleanLabel = rawLabel.trim();
        routeName = routeName ? `${cleanLabel} (${routeName})` : cleanLabel;
      }

      // 노선명 정밀 유효성 검사
      if (!isValidRouteName(routeName)) {
        if (category && isValidRouteName(category)) {
          routeName = `${category} 정규 노선`;
        } else {
          continue; // 유효하지 않은 노선 건너뜀
        }
      }

      // ── 기사명 정밀 검증 ──
      const driverName = isValidDriverName(rawDriver) ? rawDriver.trim() : null;

      // ── 차량번호 정밀 정제 ──
      const plateNumber = cleanPlateNumber(rawPlate);

      // 기사도 차량도 없는 미운행 행은 제외
      if (!driverName && !plateNumber) continue;

      const dispatchType: 'FIXED' | 'NORMAL' = /OT|출장|일반|임시/i.test(category) || /OT|출장|일반/i.test(routeName)
        ? 'NORMAL'
        : 'FIXED';

      records.push({
        sourceFile: path.basename(filePath),
        sheetName,
        rowNumber: r + 1,
        date: sheetDate,
        routeName,
        clientName: client || '앰코',
        driverName,
        plateNumber,
        dispatchType,
      });
    }
  }

  console.log(`  ✔ [파일 1 정제 완료] 총 ${records.length.toLocaleString()}건 유효 배차 정제 완료`);
  return records;
}

// ─────────────────────────────────────────────────────────────
// 파서 2: '기간별 - 2026 설하.xlsx' 정밀 파싱
// ─────────────────────────────────────────────────────────────
function parsePeriodFile(filePath: string): ParsedHistoryRecord[] {
  console.log(`\n📖 [파일 2 정밀 파싱] ${path.basename(filePath)}`);
  const wb = XLSX.readFile(filePath);
  const records: ParsedHistoryRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'sheet1') continue;

    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    if (!rows || rows.length < 6) continue;

    // 상단 정보에서 기본 대상 차량번호 및 기사명 추출
    let defaultPlate = cleanPlateNumber(sheetName);
    let defaultDrivers: string[] = [];

    for (let r = 0; r < Math.min(rows.length, 6); r++) {
      const line = (rows[r] ?? []).map(text).join(' ');
      if (line.includes('대상차량') || line.includes('기사성명')) {
        const plateMatch = line.match(/(?:경기|인천|서울)?\s*\d{2,3}\s*[가-힣]\s*(\d{4})/);
        if (plateMatch) defaultPlate = plateMatch[1];

        const driverMatch = line.match(/기사성명\s*[:：]\s*([^\n\r]+)/);
        if (driverMatch) {
          defaultDrivers = driverMatch[1]
            .split(/[,/·\s]+/)
            .map((s) => s.trim())
            .filter((s) => isValidDriverName(s));
        }
        break;
      }
    }

    // 근무내역 섹션 헤더 탐색
    let dutyHeaderIdx = -1;
    let colDate = 0;
    let colDriver = 1;
    let colRoute = 3;

    for (let r = 0; r < Math.min(rows.length, 12); r++) {
      const head = (rows[r] ?? []).map(norm);
      const hasDriver = head.some((c) => c.includes('승무원') || c.includes('기사'));
      const hasRoute = head.some((c) => c.includes('노선') || c.includes('구간') || c.includes('적요'));

      if (hasDriver && hasRoute) {
        dutyHeaderIdx = r;
        head.forEach((c, idx) => {
          if (c.includes('날짜') || c.includes('일자')) colDate = idx;
          if (c.includes('승무원') || c.includes('기사')) colDriver = idx;
          if (c.includes('노선') || c.includes('구간') || c.includes('적요')) colRoute = idx;
        });
        break;
      }
    }

    if (dutyHeaderIdx === -1) continue;

    let currentDriver = defaultDrivers[0] ?? null;
    let currentDate = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // 2026년 1월 기본

    for (let r = dutyHeaderIdx + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const firstCell = norm(row[0]);
      if (firstCell.includes('차량입금') || firstCell.includes('차량출금') || firstCell.includes('합계') || firstCell.includes('소계')) {
        break;
      }

      const rawDate = row[colDate];
      const rawDriver = text(row[colDriver]);
      const rawRoute = text(row[colRoute]);

      if (!rawDate && !rawDriver && !rawRoute) continue;

      // 기사명 정밀 검증
      if (isValidDriverName(rawDriver)) {
        currentDriver = rawDriver.trim();
      }

      // 날짜 파싱
      const parsedDate = parseExcelDate(rawDate);
      if (parsedDate) {
        currentDate = parsedDate;
      }

      // 노선명 정밀 정제
      const routeCandidate = cleanRouteName(rawRoute);
      if (!isValidRouteName(routeCandidate)) continue;

      const dispatchType: 'FIXED' | 'NORMAL' = /OT|출장|일반|어린이집|등산|학원/i.test(routeCandidate)
        ? 'NORMAL'
        : 'FIXED';

      records.push({
        sourceFile: path.basename(filePath),
        sheetName,
        rowNumber: r + 1,
        date: currentDate,
        routeName: routeCandidate,
        clientName: '앰코',
        driverName: currentDriver,
        plateNumber: defaultPlate,
        dispatchType,
      });
    }
  }

  console.log(`  ✔ [파일 2 정제 완료] 총 ${records.length.toLocaleString()}건 유효 배차 정제 완료`);
  return records;
}

// ─────────────────────────────────────────────────────────────
// DB Upsert 및 정제 데이터 적재 파이프라인
// ─────────────────────────────────────────────────────────────
async function migrateHistoryData(
  records: ParsedHistoryRecord[],
  fileName: string
): Promise<MigrationStats> {
  const stats: MigrationStats = {
    file: fileName,
    totalParsed: records.length,
    successCount: 0,
    failCount: 0,
    newRoutes: 0,
    newDrivers: 0,
    newVehicles: 0,
  };

  if (records.length === 0) return stats;

  const company =
    (await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })) ??
    (await prisma.company.create({ data: { name: '스마트여행사' } }));

  // 1. 노선, 기사, 차량 마스터 정제 수집
  const routeMap = new Map<string, { name: string; clientName: string }>();
  const driverSet = new Set<string>();
  const plateSet = new Set<string>();

  for (const r of records) {
    if (isValidRouteName(r.routeName)) {
      routeMap.set(r.routeName, { name: r.routeName, clientName: r.clientName });
    }
    if (r.driverName && isValidDriverName(r.driverName)) {
      driverSet.add(r.driverName);
    }
    if (r.plateNumber && cleanPlateNumber(r.plateNumber)) {
      plateSet.add(cleanPlateNumber(r.plateNumber)!);
    }
  }

  // 2. Route Upsert
  const routeIdByName = new Map<string, string>();
  const existingRoutes = await prisma.route.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true },
  });
  existingRoutes.forEach((r) => routeIdByName.set(r.name, r.id));

  const newRoutes: { id: string; companyId: string; name: string; clientName: string; billingPrice: number; payoutPrice: number }[] = [];
  for (const [rName, rData] of routeMap.entries()) {
    if (!routeIdByName.has(rName)) {
      const newId = randomUUID();
      newRoutes.push({
        id: newId,
        companyId: company.id,
        name: rData.name,
        clientName: rData.clientName,
        billingPrice: 0,
        payoutPrice: 0,
      });
      routeIdByName.set(rName, newId);
      stats.newRoutes++;
    }
  }
  if (newRoutes.length > 0) {
    await prisma.route.createMany({ data: newRoutes });
  }

  // 3. Driver Upsert (PostgreSQL 고속 배치)
  const driverIdByName = new Map<string, string>();
  const existingDrivers = await prisma.driver.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true },
  });
  existingDrivers.forEach((d) => driverIdByName.set(d.name, d.id));

  const newDrivers: { id: string; companyId: string; name: string; employmentType: string; dependentsCount: number }[] = [];
  for (const dName of driverSet) {
    if (!driverIdByName.has(dName)) {
      const newId = randomUUID();
      newDrivers.push({
        id: newId,
        companyId: company.id,
        name: dName,
        employmentType: 'OWN',
        dependentsCount: 1,
      });
      driverIdByName.set(dName, newId);
      stats.newDrivers++;
    }
  }
  if (newDrivers.length > 0) {
    await prisma.driver.createMany({ data: newDrivers });
  }

  // 4. Vehicle Upsert (PostgreSQL 고속 배치)
  const vehicleIdByPlate = new Map<string, string>();
  const existingVehicles = await prisma.vehicle.findMany({
    where: { companyId: company.id },
    select: { id: true, plateNumber: true },
  });
  existingVehicles.forEach((v) => vehicleIdByPlate.set(v.plateNumber, v.id));

  const newVehicles: { id: string; companyId: string; plateNumber: string; capacity: number }[] = [];
  for (const plate of plateSet) {
    if (!vehicleIdByPlate.has(plate)) {
      const newId = randomUUID();
      newVehicles.push({
        id: newId,
        companyId: company.id,
        plateNumber: plate,
        capacity: 45,
      });
      vehicleIdByPlate.set(plate, newId);
      stats.newVehicles++;
    }
  }
  if (newVehicles.length > 0) {
    await prisma.vehicle.createMany({ data: newVehicles });
  }

  // 5. 유효 데이터 선별 및 배치 적재
  const validDispatches: {
    id: string;
    companyId: string;
    routeId: string;
    date: Date;
    type: 'FIXED' | 'NORMAL';
  }[] = [];

  const validAssignments: {
    id: string;
    dispatchId: string;
    driverId: string | null;
    vehicleId: string | null;
    status: string;
  }[] = [];

  for (const r of records) {
    const routeId = routeIdByName.get(r.routeName);
    if (!routeId) {
      stats.failCount++;
      continue;
    }

    const driverId = r.driverName ? driverIdByName.get(r.driverName) ?? null : null;
    const vehicleId = r.plateNumber ? vehicleIdByPlate.get(r.plateNumber) ?? null : null;
    const dispatchId = randomUUID();

    validDispatches.push({
      id: dispatchId,
      companyId: company.id,
      routeId,
      date: r.date,
      type: r.dispatchType,
    });

    validAssignments.push({
      id: randomUUID(),
      dispatchId,
      driverId,
      vehicleId,
      status: driverId && vehicleId ? 'ASSIGNED' : 'PENDING',
    });
  }

  const CHUNK_SIZE = 500;
  console.log(`  💾 정제된 유효 데이터 일괄 적재 진행 (${validDispatches.length.toLocaleString()}건)...`);

  // PostgreSQL 트랜잭션 옵션: 원격 네트워크/대규모 일괄 처리 지연에 대비해 timeout(60초) 및 maxWait(15초) 적용
  for (let i = 0; i < validDispatches.length; i += CHUNK_SIZE) {
    const dispatchChunk = validDispatches.slice(i, i + CHUNK_SIZE);
    const assignmentChunk = validAssignments.slice(i, i + CHUNK_SIZE);

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.dispatch.createMany({ data: dispatchChunk });
          await tx.dispatchAssignment.createMany({ data: assignmentChunk });
        },
        {
          timeout: 60000,
          maxWait: 15000,
        }
      );
      stats.successCount += dispatchChunk.length;
    } catch (batchErr: any) {
      console.warn(`    ⚠️ 청크 적재 오류: ${batchErr.message}`);
      stats.failCount += dispatchChunk.length;
    }
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────
// 메인 마이그레이션 실행 함수
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('===============================================================');
  console.log('🧹 [과거 수기 엑셀 데이터 정밀 정제 & 재적재 마이그레이션]');
  console.log('===============================================================');

  // 0. 기존 DB 오염 데이터 초기화 (기초 시드 데이터는 보존하거나 깨끗하게 초기화)
  console.log('🧹 기존 수기 마이그레이션 배차 및 노이즈 마스터 데이터 정리 중...');
  await prisma.dispatchAssignment.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.route.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.driver.deleteMany();

  // 회사 확인/생성
  const company =
    (await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })) ??
    (await prisma.company.create({ data: { name: '스마트여행사' } }));

  // 기본 시드 기초 노선/기사 복원 (2026-09 테스트용 기본 데이터 보장)
  const d1 = await prisma.driver.create({ data: { companyId: company.id, name: '오이섭', employmentType: 'OWN' } });
  const d2 = await prisma.driver.create({ data: { companyId: company.id, name: '박광열', employmentType: 'AFFILIATED' } });
  const d3 = await prisma.driver.create({ data: { companyId: company.id, name: '노달환', employmentType: 'OUTSOURCED' } });

  const v1 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '3590', capacity: 45 } });
  const v2 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '5041', capacity: 45 } });
  const v3 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '7167', capacity: 45 } });

  const r1 = await prisma.route.create({
    data: { companyId: company.id, name: '1호차 (임학역 - K5)', clientName: '앰코', billingPrice: 100000, payoutPrice: 45000 }
  });
  const r2 = await prisma.route.create({
    data: { companyId: company.id, name: '2호차 (경인교대 - K5)', clientName: '앰코', billingPrice: 100000, payoutPrice: 45000 }
  });

  // 2026년 9월 26일~10월 5일 기초 10일치 배차 복원
  const startDate = new Date('2026-09-26T00:00:00Z');
  for (let i = 0; i < 10; i++) {
    const curDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dp1 = await prisma.dispatch.create({ data: { companyId: company.id, routeId: r1.id, date: curDate, type: 'FIXED' } });
    await prisma.dispatchAssignment.create({ data: { dispatchId: dp1.id, driverId: i % 2 === 0 ? d1.id : d2.id, vehicleId: i % 2 === 0 ? v1.id : v2.id, status: 'ASSIGNED' } });

    const dp2 = await prisma.dispatch.create({ data: { companyId: company.id, routeId: r2.id, date: curDate, type: 'FIXED' } });
    await prisma.dispatchAssignment.create({ data: { dispatchId: dp2.id, driverId: i % 3 === 0 ? d3.id : d1.id, vehicleId: i % 3 === 0 ? v3.id : v1.id, status: 'ASSIGNED' } });
  }
  console.log('✔ 기본 2026-09 기초 배차 데이터 복원 완료\n');

  // 과거 수기 엑셀 2종 정밀 파싱 및 적재 실행
  const totalSummary: MigrationStats[] = [];

  try {
    for (const fileName of TARGET_FILES) {
      const resolvedPath = resolveFilePath(fileName);
      if (!resolvedPath) {
        console.error(`❌ 파일 없음: ${fileName}`);
        continue;
      }

      console.log(`📂 정제 대상 파일: ${resolvedPath}`);
      let parsedRecords: ParsedHistoryRecord[] = [];

      if (fileName.includes('월정산')) {
        parsedRecords = parseMonthlySettlementFile(resolvedPath);
      } else if (fileName.includes('기간별')) {
        parsedRecords = parsePeriodFile(resolvedPath);
      }

      const stats = await migrateHistoryData(parsedRecords, fileName);
      totalSummary.push(stats);
    }

    console.log('\n===============================================================');
    console.log('📊 [정제 마이그레이션 최종 완료 보고서]');
    console.log('===============================================================');

    for (const s of totalSummary) {
      console.log(`📄 파일: ${s.file}`);
      console.log(`   - 파싱 건수: ${s.totalParsed.toLocaleString()}건`);
      console.log(`   - ✅ DB 적재 성공: ${s.successCount.toLocaleString()}건`);
      console.log(`   - 신규 마스터: 노선 ${s.newRoutes}개 / 기사 ${s.newDrivers}명 / 차량 ${s.newVehicles}대`);
    }

    // 최종 클린 데이터 검증
    const [finalRoutes, finalDrivers, finalVehicles, finalDispatches] = await Promise.all([
      prisma.route.count(),
      prisma.driver.count(),
      prisma.vehicle.count(),
      prisma.dispatch.count(),
    ]);

    console.log('\n---------------------------------------------------------------');
    console.log(`✨ [정제 완료 후 DB 현황]`);
    console.log(`   - 정상 노선 수: ${finalRoutes.toLocaleString()}개`);
    console.log(`   - 정상 기사 수: ${finalDrivers.toLocaleString()}명`);
    console.log(`   - 정상 차량 수: ${finalVehicles.toLocaleString()}대`);
    console.log(`   - 총 배차 데이터: ${finalDispatches.toLocaleString()}건`);
    console.log('===============================================================\n');
  } catch (err: any) {
    console.error('❌ 정제 마이그레이션 중 오류:', err);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Prisma 연결이 안전하게 종료되었습니다.');
  }
}

main();
