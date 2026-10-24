import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership, isGroupAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeNetBalances } from "@/lib/finance";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const { id, userId } = params;
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
        { error: { code: "FORBIDDEN", message: "You are not a member of this group" } },
        { status: 403 }
      );
    }

    const isSelfLeaving = user.id === userId;
    const isCurrentAdmin = isGroupAdmin(membership.role);

    if (!isSelfLeaving && !isCurrentAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only group admins can remove other members" } },
        { status: 403 }
      );
    }

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
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

    const nets = computeNetBalances(
      allExpenses,
      allSplits,
      allSettlements,
      group.members.map((m) => m.userId)
    );

    const targetBalance = nets[userId] || 0;
    if (targetBalance !== 0) {
      return NextResponse.json(
        {
          error: {
            code: "NON_ZERO_BALANCE",
            message: `Cannot remove member with non-zero balance (${targetBalance > 0 ? "they are owed money" : "they owe money"}). Settle all balances first.`,
          },
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.delete({
        where: {
          groupId_userId: {
            groupId: id,
            userId,
          },
        },
      });

      await tx.activity.create({
        data: {
          groupId: id,
          actorId: user.id,
          type: "MEMBER_REMOVED",
          payload: { removedUserId: userId, isSelfLeaving },
        },
      });
    });

    return NextResponse.json({
      data: { message: isSelfLeaving ? "You left the group" : "Member removed successfully" },
    });
  } catch (error: any) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } },
      { status: 500 }
    );
  }
}
