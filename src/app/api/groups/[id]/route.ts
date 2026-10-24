import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership, isGroupAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { createGroupSchema } from "@/lib/validators";

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
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Group not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        ...group,
        currentUserRole: membership.role,
      },
    });
  } catch (error: any) {
    console.error("GET group by id error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch group" } },
      { status: 500 }
    );
  }
}

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

    const membership = await checkGroupMembership(id, user.id);
    if (!membership || !isGroupAdmin(membership.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only group admins can update group details" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const g = await tx.group.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          emoji: parsed.data.emoji || null,
        },
      });

      await tx.activity.create({
        data: {
          groupId: id,
          actorId: user.id,
          type: "GROUP_UPDATED",
          payload: { action: "renamed", newName: g.name },
        },
      });

      return g;
    });

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error("PATCH group error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update group" } },
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

    const membership = await checkGroupMembership(id, user.id);
    if (!membership || !isGroupAdmin(membership.role)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only group admins can delete the group" } },
        { status: 403 }
      );
    }

    await prisma.group.delete({
      where: { id },
    });

    return NextResponse.json({ data: { message: "Group deleted successfully" } });
  } catch (error: any) {
    console.error("DELETE group error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to delete group" } },
      { status: 500 }
    );
  }
}
