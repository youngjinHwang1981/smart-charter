/**
 * 엑셀 배차 데이터 → DB 일괄 적재 파이프라인
 *
 * 실행:
 *   npx tsx prisma/import-excel.ts [엑셀파일경로] [--dry-run] [--include-empty] [--sheets=26,27]
 *
 * 처리 단계:
 *   1) Extract   : xlsx로 시트를 읽어 2차원 JSON 배열로 변환
 *   2) Transform : 헤더 자동 탐지 → 행 단위 정규화 레코드(ParsedRow) 생성
 *   3) Load      : 단일 prisma.$transaction 안에서
 *                  Route / Driver / Vehicle Upsert → 기존 동일 일자 배차 교체
 *                  → Dispatch / DispatchAssignment 일괄 생성
 *
 * 지원 포맷:
 *   - 일자별 시트 포맷(현행 배차표): 상단에 날짜(엑셀 시리얼), 헤더 '거래처/운행구분/노선및시간/출발지/차량번호/승무원'
 *   - 단순 평면 포맷: 헤더 '날짜 / 노선명 / 기사명 / 차량번호 (/ 거래처 / 구분)'
 */
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// 설정
// ─────────────────────────────────────────────────────────────
const DEFAULT_FILE = '배차 - 2610 (0926-1025).xlsx';
const ROSTER_SHEET = '명단';
/** 일자별 시트(시트명이 숫자 '1'~'31')가 존재하면 해당 시트만 적재 (입력/집계 시트 중복 적재 방지) */
const DAY_SHEET_PATTERN = /^\d{1,2}$/;
const DEFAULT_CLIENT = '미지정';
const DEFAULT_VEHICLE_CAPACITY = 45;
const TRANSACTION_TIMEOUT_MS = 120_000;

/** 헤더 별칭 (공백 제거 후 비교) */
const HEADER_ALIASES = {
  date: ['날짜', '배차일자', '운행일자', '일자'],
  routeName: ['노선명'],
  routePath: ['출발지', '운행구간', '노선'],
  routeLabel: ['노선및시간', '호차'],
  client: ['거래처', '발주처', '고객사'],
  category: ['운행구분', '구분'],
  driver: ['기사명', '승무원', '성명', '기사'],
  plate: ['차량번호', '차량'],
} as const;
type HeaderKey = keyof typeof HEADER_ALIASES;

const CLI_ARGS = process.argv.slice(2);
const DRY_RUN = CLI_ARGS.includes('--dry-run');
/** 기사·차량 모두 비어 있는 행(운행 없음)도 미배정 배차로 적재할지 여부 */
const INCLUDE_EMPTY = CLI_ARGS.includes('--include-empty');
const SHEET_ARG = CLI_ARGS.find((a) => a.startsWith('--sheets='));
const FILE_ARG = CLI_ARGS.find((a) => !a.startsWith('--'));

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────
type DispatchType = 'FIXED' | 'NORMAL';

interface ParsedRow {
  sheet: string;
  rowNo: number; // 엑셀 기준 행 번호 (1-based, 로그용)
  date: Date; // UTC 자정
  routeName: string;
  clientName: string;
  type: DispatchType;
  /** 교대 운전 확장: 한 배차에 복수 기사/차량 할당 가능 */
  crews: { driverName: string | null; plateNumber: string | null }[];
}

interface RosterEntry {
  employmentType: string;
  capacity: number;
}

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────
const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '');
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** 엑셀 시리얼/Date/문자열 → UTC 자정 Date (앱 전체가 UTC 자정 기준으로 날짜를 저장) */
function toUtcDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    // 엑셀 날짜 시리얼 범위(약 1990~2064년)만 날짜로 인정
    if (v < 30000 || v > 60000) return null;
    const p = XLSX.SSF.parse_date_code(v);
    return p ? new Date(Date.UTC(p.y, p.m - 1, p.d)) : null;
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  const m = String(v).match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

/** 차량번호 정규화: 0/빈값 → null, 대차 표시(*) 제거 */
function cleanPlate(v: unknown): string | null {
  const s = text(v).replace(/\*/g, '').trim();
  return !s || s === '0' ? null : s;
}

/** 운행구간 앞의 출발시각 '(04:18)' / '09:10' 제거 */
function stripLeadingTime(s: string): string {
  return s.replace(/^\(?\s*\d{1,2}:\d{2}\s*\)?\s*/, '').trim();
}

/** 운행구분 → 배차 유형 (OT·출장성 운행은 일반, 그 외 정기 통근은 고정) */
function toDispatchType(category: string): DispatchType {
  return /OT|출장|일반|임시/i.test(category) ? 'NORMAL' : 'FIXED';
}

/** '김상훈/이상무' 처럼 한 셀에 복수 기사가 기재된 교대 운전 케이스 분리 */
const splitMulti = (s: string) =>
  s
    .split(/[\/,·&]/)
    .map((x) => x.trim())
    .filter(Boolean);

// ─────────────────────────────────────────────────────────────
// 1) Extract + 2) Transform
// ─────────────────────────────────────────────────────────────

/** 상위 15행에서 '차량번호' + '기사' 별칭을 모두 포함하는 헤더 행을 탐지하고 컬럼 맵 생성 */
function detectHeader(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map(norm);
    const has = (key: HeaderKey) => cells.some((c) => (HEADER_ALIASES[key] as readonly string[]).includes(c));
    if (!has('plate') || !has('driver')) continue;

    // 2단 헤더 대응: 현재 행 우선, 비어 있는 칸은 바로 위 행의 헤더로 보완
    const upper = (rows[i - 1] ?? []).map(norm);
    const width = Math.max(cells.length, upper.length);
    const colMap: Partial<Record<HeaderKey, number>> = {};
    for (let c = 0; c < width; c++) {
      const label = cells[c] || upper[c];
      if (!label) continue;
      for (const key of Object.keys(HEADER_ALIASES) as HeaderKey[]) {
        if (colMap[key] === undefined && (HEADER_ALIASES[key] as readonly string[]).includes(label)) {
          colMap[key] = c;
        }
      }
    }
    if (colMap.routeName === undefined && colMap.routePath === undefined) continue;
    return { headerRow: i, colMap };
  }
  return null;
}

/** 헤더 위쪽 영역에서 시트 공통 배차일자(엑셀 날짜 시리얼) 탐색 */
function findSheetDate(rows: unknown[][], headerRow: number): Date | null {
  for (let i = 0; i < headerRow; i++) {
    for (const cell of rows[i] ?? []) {
      const d = toUtcDate(cell);
      if (d) return d;
    }
  }
  return null;
}

function parseSheet(sheetName: string, rows: unknown[][]): { parsed: ParsedRow[]; skipped: number } | null {
  const header = detectHeader(rows);
  if (!header) return null;
  const { headerRow, colMap } = header;
  const sheetDate = colMap.date === undefined ? findSheetDate(rows, headerRow) : null;
  if (colMap.date === undefined && !sheetDate) return null; // 날짜를 특정할 수 없는 시트(명단 등) 제외

  const get = (row: unknown[], key: HeaderKey) => (colMap[key] === undefined ? '' : text(row[colMap[key]!]));
  const parsed: ParsedRow[] = [];
  let skipped = 0;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];

    // 노선명: '노선명' 컬럼 우선, 없으면 [호차 라벨] + 운행구간(출발시각 제거)으로 합성
    let routeName = get(row, 'routeName');
    if (!routeName) {
      const routePath = stripLeadingTime(get(row, 'routePath'));
      if (!routePath) continue; // 공백/합계 행
      const rawLabel = colMap.routeLabel === undefined ? null : row[colMap.routeLabel];
      const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''; // 숫자(시각 분수)는 라벨 아님
      routeName = label ? `${label} ${routePath}` : routePath;
    }
    const category = get(row, 'category');
    if (/합계|소계/.test(category) || /합계|소계/.test(routeName)) continue;

    const date = colMap.date === undefined ? sheetDate : toUtcDate(row[colMap.date]);
    if (!date) {
      skipped++;
      console.warn(`  ⚠️  [${sheetName}] ${i + 1}행: 날짜 파싱 실패 → 건너뜀`);
      continue;
    }

    const drivers = splitMulti(get(row, 'driver'));
    const plates = splitMulti(get(row, 'plate')).map(cleanPlate).filter((p): p is string => !!p);
    const crewCount = Math.max(drivers.length, plates.length);

    if (crewCount === 0 && !INCLUDE_EMPTY) {
      skipped++; // 기사·차량 모두 없음 = 해당 일자 미운행
      continue;
    }

    const crews =
      crewCount === 0
        ? [{ driverName: null, plateNumber: null }]
        : Array.from({ length: crewCount }, (_, k) => ({
            driverName: drivers[k] ?? null,
            // 교대 근무 시 차량은 1대를 공유하는 경우가 일반적 → 차량 수가 부족하면 첫 차량 재사용
            plateNumber: plates[k] ?? plates[0] ?? null,
          }));

    parsed.push({
      sheet: sheetName,
      rowNo: i + 1,
      date,
      routeName,
      clientName: get(row, 'client') || DEFAULT_CLIENT,
      type: toDispatchType(category),
      crews,
    });
  }

  return { parsed, skipped };
}

/** '명단' 시트 → 기사 고용형태 / 차량 정원 보조 정보 */
function parseRoster(workbook: XLSX.WorkBook) {
  const drivers = new Map<string, RosterEntry>();
  const vehicles = new Map<string, RosterEntry>();
  const sheet = workbook.Sheets[ROSTER_SHEET];
  if (!sheet) return { drivers, vehicles };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const head = (rows[0] ?? []).map(norm);
  const idx = (names: string[]) => head.findIndex((h) => names.includes(h));
  const cPlate = idx(['차량번호']);
  const cName = idx(['승무원', '기사명', '성명']);
  const cType = idx(['구분']);
  const cSize = idx(['차종']);

  const employment = (s: string) =>
    s.includes('지입') ? 'AFFILIATED' : s.includes('외부') || s.includes('용차') ? 'OUTSOURCED' : 'OWN';
  const capacity = (s: string) => (s.includes('소형') ? 15 : s.includes('중형') ? 25 : DEFAULT_VEHICLE_CAPACITY);

  for (const row of rows.slice(1)) {
    const entry = {
      employmentType: employment(text(row[cType])),
      capacity: capacity(text(row[cSize])),
    };
    const name = text(row[cName]);
    const plate = cleanPlate(row[cPlate]);
    if (name) drivers.set(name, entry);
    if (plate) vehicles.set(plate, entry);
  }
  return { drivers, vehicles };
}

// ─────────────────────────────────────────────────────────────
// 3) Load
// ─────────────────────────────────────────────────────────────
async function importExcelData() {
  const filePath = path.resolve(process.cwd(), FILE_ARG ?? DEFAULT_FILE);
  if (!fs.existsSync(filePath)) throw new Error(`엑셀 파일을 찾을 수 없습니다: ${filePath}`);

  console.log(`📂 엑셀 파일 로드: ${path.basename(filePath)}`);
  const workbook = XLSX.readFile(filePath);

  // 대상 시트 선정
  let targetSheets: string[];
  if (SHEET_ARG) {
    targetSheets = SHEET_ARG.replace('--sheets=', '').split(',').map((s) => s.trim());
  } else {
    const daySheets = workbook.SheetNames.filter((n) => DAY_SHEET_PATTERN.test(n.trim()));
    targetSheets = daySheets.length > 0 ? daySheets : workbook.SheetNames;
  }

  // ── Extract & Transform ──
  const records: ParsedRow[] = [];
  let skippedRows = 0;
  for (const name of targetSheets) {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      console.warn(`  ⚠️  시트 없음: ${name}`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true });
    const result = parseSheet(name, rows);
    if (!result) {
      console.log(`  ⏭️  [${name}] 배차 헤더/날짜 미탐지 → 제외`);
      continue;
    }
    records.push(...result.parsed);
    skippedRows += result.skipped;
    const d = result.parsed[0]?.date.toISOString().slice(0, 10) ?? '-';
    console.log(`  ✔ [${name}] ${d} : 배차 ${result.parsed.length}건 / 제외 ${result.skipped}행`);
  }

  if (records.length === 0) {
    console.log('적재할 배차 데이터가 없습니다.');
    return;
  }

  const roster = parseRoster(workbook);
  const routeKeys = new Map<string, { name: string; clientName: string }>();
  const driverNames = new Set<string>();
  const plateNumbers = new Set<string>();
  const dateSet = new Map<number, Date>();
  for (const r of records) {
    routeKeys.set(r.routeName, { name: r.routeName, clientName: r.clientName });
    dateSet.set(r.date.getTime(), r.date);
    for (const c of r.crews) {
      if (c.driverName) driverNames.add(c.driverName);
      if (c.plateNumber) plateNumbers.add(c.plateNumber);
    }
  }
  const dates = [...dateSet.values()].sort((a, b) => a.getTime() - b.getTime());

  console.log(
    `\n📊 파싱 결과: 배차 ${records.length}건 · 노선 ${routeKeys.size} · 기사 ${driverNames.size} · 차량 ${plateNumbers.size}` +
      ` · 기간 ${dates[0].toISOString().slice(0, 10)} ~ ${dates[dates.length - 1].toISOString().slice(0, 10)} (${dates.length}일)` +
      ` · 제외 ${skippedRows}행`
  );

  if (DRY_RUN) {
    console.log('🧪 --dry-run 모드: DB에 기록하지 않고 종료합니다.');
    return;
  }

  // ── Load: 전 과정을 단일 트랜잭션으로 처리 (중간 실패 시 전체 롤백) ──
  const stats = await prisma.$transaction(
    async (tx) => {
      const company =
        (await tx.company.findFirst({ orderBy: { createdAt: 'asc' } })) ??
        (await tx.company.create({ data: { name: '스마트여행사' } }));

      // (a) Route Upsert — 이름 기준 (스키마에 unique 제약이 없으므로 조회 후 생성)
      const routeIdByName = new Map<string, string>();
      const existingRoutes = await tx.route.findMany({
        where: { companyId: company.id, name: { in: [...routeKeys.keys()] } },
        select: { id: true, name: true },
      });
      existingRoutes.forEach((r) => routeIdByName.set(r.name, r.id));
      const newRoutes = [...routeKeys.values()]
        .filter((r) => !routeIdByName.has(r.name))
        .map((r) => ({
          id: randomUUID(),
          companyId: company.id,
          name: r.name,
          clientName: r.clientName,
          billingPrice: 0, // 단가는 엑셀에 없으므로 0으로 생성 → 정산 화면에서 별도 입력
          payoutPrice: 0,
        }));
      if (newRoutes.length) await tx.route.createMany({ data: newRoutes });
      newRoutes.forEach((r) => routeIdByName.set(r.name, r.id));

      // (b) Driver Upsert — 이름 기준
      const driverIdByName = new Map<string, string>();
      (
        await tx.driver.findMany({
          where: { companyId: company.id, name: { in: [...driverNames] } },
          select: { id: true, name: true },
        })
      ).forEach((d) => driverIdByName.set(d.name, d.id));
      const newDrivers = [...driverNames]
        .filter((n) => !driverIdByName.has(n))
        .map((name) => ({
          id: randomUUID(),
          companyId: company.id,
          name,
          employmentType: roster.drivers.get(name)?.employmentType ?? 'OWN',
        }));
      if (newDrivers.length) await tx.driver.createMany({ data: newDrivers });
      newDrivers.forEach((d) => driverIdByName.set(d.name, d.id));

      // (c) Vehicle Upsert — 차량번호 기준
      const vehicleIdByPlate = new Map<string, string>();
      (
        await tx.vehicle.findMany({
          where: { companyId: company.id, plateNumber: { in: [...plateNumbers] } },
          select: { id: true, plateNumber: true },
        })
      ).forEach((v) => vehicleIdByPlate.set(v.plateNumber, v.id));
      const newVehicles = [...plateNumbers]
        .filter((p) => !vehicleIdByPlate.has(p))
        .map((plateNumber) => ({
          id: randomUUID(),
          companyId: company.id,
          plateNumber,
          capacity: roster.vehicles.get(plateNumber)?.capacity ?? DEFAULT_VEHICLE_CAPACITY,
        }));
      if (newVehicles.length) await tx.vehicle.createMany({ data: newVehicles });
      newVehicles.forEach((v) => vehicleIdByPlate.set(v.plateNumber, v.id));

      // (d) 재실행 멱등성: 적재 대상 일자의 기존 배차를 교체 (Assignment → Dispatch 순 삭제)
      const staleDispatches = await tx.dispatch.findMany({
        where: { companyId: company.id, date: { in: dates } },
        select: { id: true },
      });
      const staleIds = staleDispatches.map((d) => d.id);
      if (staleIds.length) {
        await tx.dispatchAssignment.deleteMany({ where: { dispatchId: { in: staleIds } } });
        await tx.dispatch.deleteMany({ where: { id: { in: staleIds } } });
      }

      // (e) Dispatch + DispatchAssignment 생성 (ID를 미리 발급해 createMany로 일괄 삽입)
      const dispatchRows: {
        id: string;
        companyId: string;
        routeId: string;
        date: Date;
        type: DispatchType;
      }[] = [];
      const assignmentRows: {
        id: string;
        dispatchId: string;
        driverId: string | null;
        vehicleId: string | null;
        status: string;
      }[] = [];

      for (const r of records) {
        const dispatchId = randomUUID();
        dispatchRows.push({
          id: dispatchId,
          companyId: company.id,
          routeId: routeIdByName.get(r.routeName)!,
          date: r.date,
          type: r.type,
        });
        // 1 Dispatch : N Assignment — 교대 운전 시 기사별 Assignment 행 추가
        for (const crew of r.crews) {
          const driverId = crew.driverName ? driverIdByName.get(crew.driverName)! : null;
          const vehicleId = crew.plateNumber ? vehicleIdByPlate.get(crew.plateNumber)! : null;
          assignmentRows.push({
            id: randomUUID(),
            dispatchId,
            driverId,
            vehicleId,
            status: driverId && vehicleId ? 'ASSIGNED' : 'PENDING',
          });
        }
      }

      await tx.dispatch.createMany({ data: dispatchRows });
      await tx.dispatchAssignment.createMany({ data: assignmentRows });

      return {
        newRoutes: newRoutes.length,
        newDrivers: newDrivers.length,
        newVehicles: newVehicles.length,
        replacedDispatches: staleIds.length,
        dispatches: dispatchRows.length,
        assignments: assignmentRows.length,
      };
    },
    { timeout: TRANSACTION_TIMEOUT_MS, maxWait: 10_000 }
  );

  console.log('\n✅ 엑셀 데이터 DB 적재가 완료되었습니다.');
  console.table({
    '신규 노선': stats.newRoutes,
    '신규 기사': stats.newDrivers,
    '신규 차량': stats.newVehicles,
    '교체(삭제)된 기존 배차': stats.replacedDispatches,
    '생성된 배차(Dispatch)': stats.dispatches,
    '생성된 할당(Assignment)': stats.assignments,
  });
}

importExcelData()
  .catch((e) => {
    console.error('❌ 데이터 적재 실패 (트랜잭션 롤백됨):', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });