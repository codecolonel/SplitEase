import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeNetBalances, simplifyDebts } from "@/lib/finance";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in" } },
        { status: 401 }
      );
    }

    const membership = await checkGroupMembership(id, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not belong to this group" } },
        { status: 403 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        expenses: {
          where: { deletedAt: null },
          include: { splits: true },
        },
        settlements: true,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Group not found" } },
        { status: 404 }
      );
    }

    const allExpenses = group.expenses.map((e) => ({
      id: e.id,
      paidById: e.paidById,
      amount: e.amount,
    }));

    const allSplits = group.expenses.flatMap((e) =>
      e.splits.map((s) => ({
        expenseId: s.expenseId,
        userId: s.userId,
        amount: s.amount,
      }))
    );

    const allSettlements = group.settlements.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount,
    }));

    const memberMap = new Map(group.members.map((m) => [m.userId, m.user]));
    const memberIds = Array.from(memberMap.keys());

    const netBalances = computeNetBalances(allExpenses, allSplits, allSettlements, memberIds);
    const rawTransfers = simplifyDebts(netBalances);

    const transfers = rawTransfers.map((t) => ({
      from: {
        id: t.from,
        name: memberMap.get(t.from)?.name || "Unknown",
        email: memberMap.get(t.from)?.email || "",
      },
      to: {
        id: t.to,
        name: memberMap.get(t.to)?.name || "Unknown",
        email: memberMap.get(t.to)?.email || "",
      },
      amount: t.amount,
    }));

    const memberBalances = memberIds.map((uid) => ({
      user: memberMap.get(uid),
      netBalance: netBalances[uid] || 0,
    }));

    return NextResponse.json({
      data: {
        memberBalances,
        simplifiedTransfers: transfers,
        currentUserBalance: netBalances[user.id] || 0,
      },
    });
  } catch (error: any) {
    console.error("GET group balances error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to compute balances" } },
      { status: 500 }
    );
  }
}
