import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Role } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "You must be logged in to join" } },
        { status: 401 }
      );
    }

    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      include: {
        group: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Invalid or expired invite link" } },
        { status: 404 }
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: { code: "INVITE_INACTIVE", message: `Invite is ${invite.status.toLowerCase()}` } },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.groupMember.upsert({
        where: {
          groupId_userId: {
            groupId: invite.groupId,
            userId: user.id,
          },
        },
        update: {},
        create: {
          groupId: invite.groupId,
          userId: user.id,
          role: Role.MEMBER,
        },
      });

      if (invite.email) {
        await tx.groupInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        });
      }

      await tx.activity.create({
        data: {
          groupId: invite.groupId,
          actorId: user.id,
          type: "MEMBER_JOINED",
          payload: { userName: user.name, userEmail: user.email },
        },
      });
    });

    return NextResponse.json({
      data: {
        groupId: invite.groupId,
        groupName: invite.group.name,
        message: `Successfully joined ${invite.group.name}!`,
      },
    });
  } catch (error: any) {
    console.error("Accept invite error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to accept invite" } },
      { status: 500 }
    );
  }
}
