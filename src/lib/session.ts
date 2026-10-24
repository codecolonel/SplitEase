import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export async function getCurrentUser() {
  try {
    const session = await getServerSession(authOptions);
    return session?.user ?? null;
  } catch (error) {
    return null;
  }
}

export async function checkGroupMembership(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    include: {
      group: true,
    },
  });

  return membership;
}

export function isGroupAdmin(role?: Role | null): boolean {
  return role === Role.ADMIN;
}
