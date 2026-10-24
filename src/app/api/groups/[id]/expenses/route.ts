import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createExpenseSchema } from "@/lib/validators";
import { Category, SplitType } from "@prisma/client";

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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const memberId = searchParams.get("memberId");
    const q = searchParams.get("q");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const whereClause: any = {
      groupId: id,
      deletedAt: null,
    };

    if (category && category !== "ALL") {
      whereClause.category = category as Category;
    }

    if (memberId && memberId !== "ALL") {
      whereClause.OR = [
        { paidById: memberId },
        { splits: { some: { userId: memberId } } },
      ];
    }

    if (q && q.trim()) {
      whereClause.description = {
        contains: q.trim(),
        mode: "insensitive",
      };
    }

    if (from || to) {
      whereClause.date = {};
      if (from) whereClause.date.gte = new Date(from);
      if (to) whereClause.date.lte = new Date(to);
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        paidBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        splits: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({ data: expenses });
  } catch (error: any) {
    console.error("GET expenses error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch expenses" } },
      { status: 500 }
    );
  }
}

export async function POST(
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

    const expense = await prisma.$transaction(async (tx) => {
      const exp = await tx.expense.create({
        data: {
          groupId: id,
          description,
          amount,
          date: new Date(date),
          category: category as Category,
          splitType: splitType as SplitType,
          paidById,
          createdById: user.id,
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
          groupId: id,
          actorId: user.id,
          type: "EXPENSE_CREATED",
          payload: {
            expenseId: exp.id,
            description: exp.description,
            amount: exp.amount,
            paidByName: exp.paidBy.name,
          },
        },
      });

      return exp;
    });

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    console.error("POST expense error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create expense" } },
      { status: 500 }
    );
  }
}
