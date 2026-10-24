"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, Plus, Sparkles } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-extrabold text-lg shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            ₹
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-base tracking-tight text-slate-900 group-hover:text-emerald-600 transition-colors">
              SplitEase
            </span>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-500" />
                Dashboard
              </Link>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shadow-inner">
                  {session.user.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="hidden md:flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-none">
                    {session.user.name}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                    {session.user.email}
                  </span>
                </div>

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="Sign out"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg btn-vivid"
              >
                Sign Up Free
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
