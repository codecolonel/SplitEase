"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    try {
      setJoining(true);
      setError("");

      const res = await fetch(`/api/invites/${params.token}/accept`, {
        method: "POST",
      });

      const json = await res.json();
      if (res.ok) {
        showToast(json.data.message || "Joined group!", "success");
        router.push(`/groups/${json.data.groupId}`);
      } else {
        setError(json.error?.message || "Failed to join group");
        showToast(json.error?.message || "Failed to join", "error");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setJoining(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center mb-4">
          <Users className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You&apos;ve Been Invited!</h1>
        <p className="text-sm text-slate-500 mb-6">
          Please log in or create an account to accept this invite and join the group.
        </p>
        <Link
          href={`/login?callbackUrl=/invite/${params.token}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md transition"
        >
          Sign In to Accept
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center mb-4">
        <Users className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Join Group
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        You are signed in as <span className="font-semibold text-slate-800 dark:text-slate-200">{session.user.name}</span>. Click below to join this group.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleJoin}
        disabled={joining}
        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
      >
        {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : "Accept & Join Group"}
      </button>
    </div>
  );
}
