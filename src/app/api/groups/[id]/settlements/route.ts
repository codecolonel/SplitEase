import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createSettlementSchema } from "@/lib/validators";

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
    const parsed = createSettlementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid settlement data",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { toUserId, amount, date, note } = parsed.data;

    if (toUserId === user.id) {
      return NextResponse.json(
        { error: { code: "INVALID_SETTLEMENT", message: "Cannot settle with yourself" } },
        { status: 400 }
      );
    }

    const recipientMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: id,
          userId: toUserId,
        },
      },
      include: { user: true },
    });

    if (!recipientMembership) {
      return NextResponse.json(
        { error: { code: "USER_NOT_IN_GROUP", message: "Recipient is not a member of this group" } },
        { status: 400 }
      );
    }

    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          groupId: id,
          fromUserId: user.id,
          toUserId,
          amount,
          date: date ? new Date(date) : new Date(),
          note: note || null,
        },
        include: {
          fromUser: { select: { id: true, name: true } },
          toUser: { select: { id: true, name: true } },
        },
      });

      await tx.activity.create({
        data: {
          groupId: id,
          actorId: user.id,
          type: "SETTLEMENT_CREATED",
          payload: {
            toUserName: recipientMembership.user.name,
            amount,
            note: note || "",
          },
        },
      });

      return s;
    });

    return NextResponse.json({ data: settlement }, { status: 201 });
  } catch (error: any) {
    console.error("POST settlement error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to record settlement" } },
      { status: 500 }
    );
  }
}
