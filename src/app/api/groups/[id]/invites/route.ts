import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";
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

    const token = randomBytes(16).toString("hex");

    const invite = await prisma.groupInvite.create({
      data: {
        groupId: id,
        invitedById: user.id,
        token,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      data: {
        token: invite.token,
        inviteUrl: `/invite/${invite.token}`,
      },
    });
  } catch (error: any) {
    console.error("Create group invite link error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to create invite link" } },
      { status: 500 }
    );
  }
}
