"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/finance";
import {
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  Loader2,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface GroupSummary {
  id: string;
  name: string;
  emoji: string;
  userNetBalance: number;
  memberCount: number;
}

interface DashboardData {
  totalYouOwe: number;
  totalYouAreOwed: number;
  netBalance: number;
  groups: GroupSummary[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupEmoji, setNewGroupEmoji] = useState("🌴");
  const [creating, setCreating] = useState(false);
  const { showToast } = useToast();

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      if (res.ok) {
        setData(json.data);
      } else {
        showToast("Failed to load dashboard data", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
          emoji: newGroupEmoji || "👥",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showToast("Group created successfully!", "success");
        setShowCreateModal(false);
        setNewGroupName("");
        setNewGroupDesc("");
        fetchDashboard();
      } else {
        showToast(json.error?.message || "Failed to create group", "error");
      }
    } catch (err) {
      showToast("Something went wrong", "error");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Loading your balances...
        </p>
      </div>
    );
  }

  const { totalYouOwe = 0, totalYouAreOwed = 0, netBalance = 0, groups = [] } = data || {};

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome to SplitEase
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage shared expenses, view who owes whom, and settle in one tap
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl btn-vivid text-xs tracking-wide"
        >
          <Plus className="w-4 h-4" />
          Create New Group
        </button>
      </div>

      {/* Hero Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {/* Net Balance Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              <span>Your Net Balance</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div
              className={`text-3xl font-extrabold tracking-tight mt-1 ${
                netBalance > 0
                  ? "text-emerald-400"
                  : netBalance < 0
                  ? "text-rose-400"
                  : "text-white"
              }`}
            >
              {netBalance > 0 ? `+${formatMoney(netBalance)}` : formatMoney(netBalance)}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span>Active across</span>
            <span className="font-semibold text-white">{groups.length} group{groups.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* You Are Owed */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <span>You Are Owed</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 tracking-tight mt-1">
              {formatMoney(totalYouAreOwed)}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Money friends owe you</span>
          </div>
        </div>

        {/* You Owe */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              <span>You Owe</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-extrabold text-rose-600 tracking-tight mt-1">
              {formatMoney(totalYouOwe)}
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Money you need to pay back</span>
          </div>
        </div>
      </div>

      {/* Groups Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Your Groups ({groups.length})
          </h2>
        </div>

        {groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              No groups yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
              Create a group for an apartment, trip, or dinner to start splitting costs.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-vivid text-xs"
            >
              <Plus className="w-4 h-4" />
              Create your first group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {groups.map((g) => {
              const isOwed = g.userNetBalance > 0;
              const owes = g.userNetBalance < 0;

              return (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="card-premium p-5 rounded-2xl flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {g.emoji || "🌴"}
                      </div>
                      <span className="p-1.5 rounded-lg text-slate-400 group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {g.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Your balance</span>
                    <span
                      className={`font-bold px-2.5 py-1 rounded-lg ${
                        isOwed
                          ? "bg-emerald-50 text-emerald-700"
                          : owes
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {isOwed
                        ? `+${formatMoney(g.userNetBalance)}`
                        : owes
                        ? `-${formatMoney(Math.abs(g.userNetBalance))}`
                        : "Settled"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              Create New Group
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Set up a group to track and split expenses with friends
            </p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Goa Trip or Flat 402"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Emoji Icon
                </label>
                <div className="flex gap-2">
                  {["🌴", "🏠", "🍕", "🚗", "🎉", "✈️", "☕"].map((em) => (
                    <button
                      type="button"
                      key={em}
                      onClick={() => setNewGroupEmoji(em)}
                      className={`text-xl p-2 rounded-xl border transition ${
                        newGroupEmoji === em
                          ? "border-emerald-500 bg-emerald-50 scale-105"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Trip or apartment notes..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl btn-vivid text-xs"
                >
                  {creating ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
