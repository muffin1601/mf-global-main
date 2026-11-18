import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPool?: Pool };

function createClient() {
  const { DATABASE_URL: connectionString } = serverEnv();
  const pool=globalForPrisma.prismaPool??new Pool({connectionString,max:1,idleTimeoutMillis:10_000,connectionTimeoutMillis:10_000});
  if(process.env.NODE_ENV!=="production")globalForPrisma.prismaPool=pool;
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
