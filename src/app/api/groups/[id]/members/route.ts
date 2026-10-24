import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";
import { addMemberSchema } from "@/lib/validators";
import { Role } from "@prisma/client";
import { randomBytes } from "crypto";

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
        { error: { code: "FORBIDDEN", message: "You are not a member of this group" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid email",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();

    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (targetUser) {
      const existingMember = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: id,
            userId: targetUser.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json(
          { error: { code: "ALREADY_MEMBER", message: "User is already a member of this group" } },
          { status: 409 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.groupMember.create({
          data: {
            groupId: id,
            userId: targetUser.id,
            role: Role.MEMBER,
          },
        });

        await tx.activity.create({
          data: {
            groupId: id,
            actorId: user.id,
            type: "MEMBER_JOINED",
            payload: { userName: targetUser.name, userEmail: targetUser.email },
          },
        });
      });

      return NextResponse.json({
        data: {
          status: "ADDED_DIRECTLY",
          user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
        },
      });
    }

    const token = randomBytes(16).toString("hex");
    await prisma.groupInvite.create({
      data: {
        groupId: id,
        email,
        token,
        invitedById: user.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      data: {
        status: "INVITE_CREATED",
        email,
        inviteUrl: `/invite/${token}`,
        token,
      },
    });
  } catch (error: any) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to add member" } },
      { status: 500 }
    );
  }
}
