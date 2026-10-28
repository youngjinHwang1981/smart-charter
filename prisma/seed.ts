import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('기존 데이터 초기화 중...');
    await prisma.dispatchAssignment.deleteMany();
    await prisma.dispatch.deleteMany();
    await prisma.route.deleteMany();
    await prisma.vehicle.deleteMany();
    await prisma.driver.deleteMany();
    await prisma.user.deleteMany();
    await prisma.company.deleteMany();

    // 1. 회사 생성
    const company = await prisma.company.create({
        data: { name: '스마트여행사' },
    });

    // 1-1. 관리자 테스트 계정 생성 (admin@smarttour.com / 1234)
    const hashedPassword = await bcrypt.hash('1234', 10);
    const adminUser = await prisma.user.create({
        data: {
            companyId: company.id,
            email: 'admin@smarttour.com',
            name: '최고관리자',
            role: 'ADMIN',
            password: hashedPassword,
        },
    });
    console.log(`👤 관리자 계정 생성 완료: ${adminUser.email} (비밀번호: 1234)`);

    // 2. 마스터 데이터(기사, 차량) 생성
    const v1 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '3590', capacity: 45 } });
    const v2 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '5041', capacity: 45 } });
    const v3 = await prisma.vehicle.create({ data: { companyId: company.id, plateNumber: '7167', capacity: 45 } });

    const d1 = await prisma.driver.create({ data: { companyId: company.id, name: '오이섭', employmentType: 'OWN' } });
    const d2 = await prisma.driver.create({ data: { companyId: company.id, name: '박광열', employmentType: 'AFFILIATED' } });
    const d3 = await prisma.driver.create({ data: { companyId: company.id, name: '노달환', employmentType: 'OUTSOURCED' } });

    // 3. 고정 노선 생성 (앰코 통근)
    const route1 = await prisma.route.create({
        data: { companyId: company.id, name: '1호차 (임학역-K5)', clientName: '앰코', billingPrice: 100000, payoutPrice: 45000 }
    });
    const route2 = await prisma.route.create({
        data: { companyId: company.id, name: '2호차 (경인교대-K5)', clientName: '앰코', billingPrice: 100000, payoutPrice: 45000 }
    });

    // 4. 2026년 9월 26일부터 10일 치 배차 스케줄 100건 자동 생성 (루프)
    const startDate = new Date('2026-09-26T00:00:00Z');

    for (let i = 0; i < 10; i++) {
        const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);

        // 1호차 일일 배차 등록
        const dispatch1 = await prisma.dispatch.create({
            data: { companyId: company.id, routeId: route1.id, date: currentDate, type: 'FIXED' }
        });
        // 1호차에 기사(홀/짝수일 교대) 배정
        await prisma.dispatchAssignment.create({
            data: {
                dispatchId: dispatch1.id,
                driverId: i % 2 === 0 ? d1.id : d2.id,
                vehicleId: i % 2 === 0 ? v1.id : v2.id,
            }
        });

        // 2호차 일일 배차 등록
        const dispatch2 = await prisma.dispatch.create({
            data: { companyId: company.id, routeId: route2.id, date: currentDate, type: 'FIXED' }
        });
        // 2호차에 기사 배정
        await prisma.dispatchAssignment.create({
            data: {
                dispatchId: dispatch2.id,
                driverId: i % 3 === 0 ? d3.id : d1.id,
                vehicleId: i % 3 === 0 ? v3.id : v1.id,
            }
        });
    }

    console.log('✅ 테스트용 기초 데이터 및 10일 치 배차 스케줄 삽입이 완료되었습니다.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });