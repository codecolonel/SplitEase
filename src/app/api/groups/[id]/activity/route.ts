import { NextResponse } from "next/server";
import { getCurrentUser, checkGroupMembership } from "@/lib/session";
import { prisma } from "@/lib/db";

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

    const activities = await prisma.activity.findMany({
      where: { groupId: id },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ data: activities });
  } catch (error: any) {
    console.error("GET activity error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch activities" } },
      { status: 500 }
    );
  }
}
