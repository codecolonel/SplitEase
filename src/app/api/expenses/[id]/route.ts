import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership, isGroupAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createExpenseSchema } from "@/lib/validators";
import { Category, SplitType } from "@prisma/client";

export async function PATCH(
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

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: { group: { include: { members: true } } },
    });

    if (!existingExpense || existingExpense.deletedAt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Expense not found" } },
        { status: 404 }
      );
    }

    const membership = await checkGroupMembership(existingExpense.groupId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not belong to this group" } },
        { status: 403 }
      );
    }

    const isCreator = existingExpense.createdById === user.id;
    const isAdmin = isGroupAdmin(membership.role);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the expense creator or group admin can edit this expense" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid expense data",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const {
      description,
      amount,
      date,
      category,
      paidById,
      splitType,
      splits,
      receiptUrl,
    } = parsed.data;

    const splitSum = splits.reduce((acc, s) => acc + s.amount, 0);
    if (splitSum !== amount) {
      return NextResponse.json(
        {
          error: {
            code: "SPLIT_MISMATCH",
            message: `Split amounts sum (${splitSum}) does not match expense total (${amount})`,
          },
        },
        { status: 400 }
      );
    }

    const updatedExpense = await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({
        where: { expenseId: id },
      });

      const updated = await tx.expense.update({
        where: { id },
        data: {
          description,
          amount,
          date: new Date(date),
          category: category as Category,
          splitType: splitType as SplitType,
          paidById,
          receiptUrl: receiptUrl || null,
          splits: {
            create: splits.map((s) => ({
              userId: s.userId,
              amount: s.amount,
              meta: s.meta ?? null,
            })),
          },
        },
        include: {
          paidBy: { select: { id: true, name: true } },
          splits: { include: { user: { select: { id: true, name: true } } } },
        },
      });

      await tx.activity.create({
        data: {
          groupId: existingExpense.groupId,
          actorId: user.id,
          type: "EXPENSE_UPDATED",
          payload: {
            expenseId: updated.id,
            description: updated.description,
            amount: updated.amount,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ data: updatedExpense });
  } catch (error: any) {
    console.error("PATCH expense error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update expense" } },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    const existingExpense = await prisma.expense.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!existingExpense || existingExpense.deletedAt) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Expense not found" } },
        { status: 404 }
      );
    }

    const membership = await checkGroupMembership(existingExpense.groupId, user.id);
    if (!membership) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "You do not belong to this group" } },
        { status: 403 }
      );
    }

    const isCreator = existingExpense.createdById === user.id;
    const isAdmin = isGroupAdmin(membership.role);

    if (!isCreator && !isAdmin) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only the expense creator or group admin can delete this expense" } },
        { status: 403 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.activity.create({
        data: {
          groupId: existingExpense.groupId,
          actorId: user.id,
          type: "EXPENSE_DELETED",
          payload: {
            expenseId: existingExpense.id,
            description: existingExpense.description,
            amount: existingExpense.amount,
          },
        },
      });
    });

    return NextResponse.json({ data: { message: "Expense deleted successfully" } });
  } catch (error: any) {
    console.error("DELETE expense error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete expense" } },
      { status: 500 }
    );
  }
}
