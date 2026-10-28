import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "이메일 로그인",
      credentials: {
        email: { label: "이메일", type: "email", placeholder: "admin@smarttour.com" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("이메일과 비밀번호를 모두 입력해 주세요.");
        }

        const searchEmail = credentials.email.trim();
        const searchPassword = credentials.password.trim();

        // 1. 사용자 조회
        const user = await prisma.user.findUnique({
          where: { email: searchEmail },
        });

        if (!user) {
          throw new Error(`등록되지 않은 이메일입니다: ${searchEmail}`);
        }

        // 2. 비밀번호 가져오기 (서버 미재시작 시 Prisma Client 메모리 캐시 누락 대비 원본 DB 조회)
        let passwordHash = user.password;
        if (!passwordHash) {
          try {
            const rawUsers: any = await prisma.$queryRawUnsafe(
              "SELECT password FROM User WHERE email = ? LIMIT 1",
              searchEmail
            );
            if (rawUsers && rawUsers.length > 0 && rawUsers[0].password) {
              passwordHash = rawUsers[0].password;
            }
          } catch (rawErr) {
            console.error("[Auth] 비밀번호 직접 쿼리 에러:", rawErr);
          }
        }

        if (!passwordHash) {
          throw new Error("비밀번호가 설정되지 않은 계정입니다.");
        }

        const isPasswordValid = await bcrypt.compare(searchPassword, passwordHash);
        if (!isPasswordValid) {
          throw new Error("비밀번호가 일치하지 않습니다.");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30일
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "smart-charter-erp-secret-key-2026-auth",
};
