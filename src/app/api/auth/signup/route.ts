import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validators";
import { Role } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input data",
            fieldErrors: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: "USER_EXISTS",
            message: "An account with this email already exists",
          },
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create user and auto-link any pending invites for their email
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          passwordHash,
        },
      });

      // Find pending invites sent to this email
      const pendingInvites = await tx.groupInvite.findMany({
        where: {
          email: normalizedEmail,
          status: "PENDING",
        },
      });

      for (const invite of pendingInvites) {
        // Add user to the group
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

        // Mark invite accepted
        await tx.groupInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        });

        // Log member joined activity
        await tx.activity.create({
          data: {
            groupId: invite.groupId,
            actorId: user.id,
            type: "MEMBER_JOINED",
            payload: { userName: user.name, userEmail: user.email },
          },
        });
      }

      return user;
    });

    return NextResponse.json(
      {
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong during signup",
        },
      },
      { status: 500 }
    );
  }
}
