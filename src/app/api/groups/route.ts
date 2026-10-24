import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createGroupSchema } from "@/lib/validators";
import { Role } from "@prisma/client";
import { computeNetBalances } from "@/lib/finance";

// GET /api/groups - lists groups for the session user with user net balances
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in" } },
        { status: 401 }
      );
    }

    const memberships = await prisma.groupMember.findMany({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
            expenses: {
              where: { deletedAt: null },
              include: {
                splits: true,
              },
            },
            settlements: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const groupsWithBalance = memberships.map((m) => {
      const g = m.group;
      const allExpenses = g.expenses.map((e) => ({
        id: e.id,
        paidById: e.paidById,
        amount: e.amount,
      }));
      const allSplits = g.expenses.flatMap((e) =>
        e.splits.map((s) => ({
          expenseId: s.expenseId,
          userId: s.userId,
          amount: s.amount,
        }))
      );
      const allSettlements = g.settlements.map((s) => ({
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: s.amount,
      }));

      const memberIds = g.members.map((mem) => mem.userId);
      const netBalances = computeNetBalances(allExpenses, allSplits, allSettlements, memberIds);
      const userNetBalance = netBalances[user.id] || 0;

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        emoji: g.emoji || "👥",
        role: m.role,
        createdAt: g.createdAt,
        memberCount: g.members.length,
        members: g.members.map((mem) => mem.user),
        userNetBalance, // paise
      };
    });

    return NextResponse.json({ data: groupsWithBalance });
  } catch (error: any) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch groups" } },
      { status: 500 }
    );
  }
}

// POST /api/groups - create group
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid group data",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { name, description, emoji } = parsed.data;

    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.group.create({
        data: {
          name,
          description: description || null,
          emoji: emoji || "👥",
          createdById: user.id,
          members: {
            create: {
              userId: user.id,
              role: Role.ADMIN,
            },
          },
        },
        include: {
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      await tx.activity.create({
        data: {
          groupId: g.id,
          actorId: user.id,
          type: "GROUP_UPDATED",
          payload: { action: "created", groupName: g.name },
        },
      });

      return g;
    });

    return NextResponse.json({ data: group }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/groups error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create group" } },
      { status: 500 }
    );
  }
}
