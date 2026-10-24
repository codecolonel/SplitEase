import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeNetBalances } from "@/lib/finance";

// GET /api/dashboard - calculates totals across all groups: totalOwe, totalOwed, net
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
            members: { select: { userId: true } },
            expenses: {
              where: { deletedAt: null },
              include: { splits: true },
            },
            settlements: true,
          },
        },
      },
    });

    let totalYouOwe = 0; // sum of negative balances in groups (converted to positive)
    let totalYouAreOwed = 0; // sum of positive balances in groups

    const groupSummaries = memberships.map((m) => {
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

      const nets = computeNetBalances(
        allExpenses,
        allSplits,
        allSettlements,
        g.members.map((mem) => mem.userId)
      );

      const userNet = nets[user.id] || 0;
      if (userNet > 0) {
        totalYouAreOwed += userNet;
      } else if (userNet < 0) {
        totalYouOwe += Math.abs(userNet);
      }

      return {
        id: g.id,
        name: g.name,
        emoji: g.emoji || "👥",
        userNetBalance: userNet,
        memberCount: g.members.length,
      };
    });

    return NextResponse.json({
      data: {
        totalYouOwe,
        totalYouAreOwed,
        netBalance: totalYouAreOwed - totalYouOwe,
        groups: groupSummaries,
      },
    });
  } catch (error: any) {
    console.error("GET dashboard totals error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load dashboard summary" } },
      { status: 500 }
    );
  }
}
