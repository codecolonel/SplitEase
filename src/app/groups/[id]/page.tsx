"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatMoney } from "@/lib/finance";
import { ExpenseModal } from "@/components/expenses/ExpenseModal";
import { SettleModal } from "@/components/balances/SettleModal";
import { useToast } from "@/components/ui/Toast";
import {
  Users,
  Receipt,
  Scale,
  HandCoins,
  History,
  PieChart,
  Plus,
  Search,
  Trash2,
  Edit,
  Share2,
  Check,
  ArrowRight,
  Download,
  Loader2,
  Calendar,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";

const CATEGORY_COLORS: Record<string, string> = {
  FOOD: "#10b981",
  TRAVEL: "#3b82f6",
  RENT: "#8b5cf6",
  GROCERIES: "#f59e0b",
  UTILITIES: "#06b6d4",
  ENTERTAINMENT: "#ec4899",
  SHOPPING: "#f97316",
  HEALTH: "#ef4444",
  OTHER: "#64748b",
};

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { data: session } = useSession();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "expenses" | "balances" | "settle" | "members" | "activity" | "charts"
  >("expenses");

  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balancesData, setBalancesData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters for expenses
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterMember, setFilterMember] = useState("ALL");

  // Modals state
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [defaultSettleRecipient, setDefaultSettleRecipient] = useState<string | undefined>();
  const [defaultSettleAmount, setDefaultSettleAmount] = useState<number | undefined>();

  // Add Member state
  const [inviteEmail, setInviteEmail] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchAllData = async () => {
    try {
      const [grpRes, expRes, balRes, actRes] = await Promise.all([
        fetch(`/api/groups/${groupId}`),
        fetch(`/api/groups/${groupId}/expenses`),
        fetch(`/api/groups/${groupId}/balances`),
        fetch(`/api/groups/${groupId}/activity`),
      ]);

      const [grp, exp, bal, act] = await Promise.all([
        grpRes.json(),
        expRes.json(),
        balRes.json(),
        actRes.json(),
      ]);

      if (grpRes.ok) setGroup(grp.data);
      if (expRes.ok) setExpenses(exp.data);
      if (balRes.ok) setBalancesData(bal.data);
      if (actRes.ok) setActivities(act.data);
    } catch (err) {
      showToast("Error loading group details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [groupId]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch = e.description
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());
      const matchesCategory =
        filterCategory === "ALL" || e.category === filterCategory;
      const matchesMember =
        filterMember === "ALL" ||
        e.paidById === filterMember ||
        e.splits.some((s: any) => s.userId === filterMember);
      return matchesSearch && matchesCategory && matchesMember;
    });
  }, [expenses, searchQuery, filterCategory, filterMember]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Expense deleted", "success");
        fetchAllData();
      } else {
        const j = await res.json();
        showToast(j.error?.message || "Failed to delete expense", "error");
      }
    } catch {
      showToast("Error deleting expense", "error");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setAddingMember(true);
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      const json = await res.json();
      if (res.ok) {
        if (json.data.status === "ADDED_DIRECTLY") {
          showToast(`Added ${json.data.user.name} to the group!`, "success");
        } else {
          showToast(
            `Invite reserved for ${json.data.email}. Share link with them!`,
            "info"
          );
        }
        setInviteEmail("");
        fetchAllData();
      } else {
        showToast(json.error?.message || "Failed to add member", "error");
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setAddingMember(false);
    }
  };

  const generateShareLink = async () => {
    try {
      const res = await fetch(`/api/groups/${groupId}/invites`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        const fullUrl = `${window.location.origin}${json.data.inviteUrl}`;
        navigator.clipboard.writeText(fullUrl);
        setCopiedLink(true);
        showToast("Invite link copied to clipboard!", "success");
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } catch {
      showToast("Failed to generate invite link", "error");
    }
  };

  const handleRemoveMember = async (userId: string, isSelf: boolean) => {
    const msg = isSelf
      ? "Are you sure you want to leave this group?"
      : "Remove this member from the group?";
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        showToast(json.data.message, "success");
        if (isSelf) {
          router.push("/dashboard");
        } else {
          fetchAllData();
        }
      } else {
        showToast(json.error?.message || "Failed to remove member", "error");
      }
    } catch {
      showToast("Error removing member", "error");
    }
  };

  const exportToCSV = () => {
    if (expenses.length === 0) {
      showToast("No expenses to export", "info");
      return;
    }

    const headers = ["Date", "Description", "Category", "Paid By", "Amount (INR)", "Split Type"];
    const rows = expenses.map((e) => [
      new Date(e.date).toLocaleDateString("en-IN"),
      `"${e.description.replace(/"/g, '""')}"`,
      e.category,
      `"${e.paidBy?.name || ""}"`,
      (e.amount / 100).toFixed(2),
      e.splitType,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${group?.name || "expenses"}-splitease.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported to CSV", "success");
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
        <p className="text-xs font-semibold text-slate-500">
          Loading group records...
        </p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Group Not Found</h2>
        <p className="text-xs text-slate-500 mb-4">
          Group not found or you don&apos;t have access.
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 btn-vivid text-xs rounded-xl"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const membersList = group.members.map((m: any) => m.user);
  const currentUserId = session?.user?.id || "";
  const isAdmin = group.currentUserRole === "ADMIN";

  const categoryTotals: Record<string, number> = {};
  for (const exp of expenses) {
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount / 100;
  }
  const pieData = Object.entries(categoryTotals).map(([cat, val]) => ({
    name: cat.charAt(0) + cat.slice(1).toLowerCase(),
    value: Math.round(val),
    color: CATEGORY_COLORS[cat] || "#64748b",
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Group Header Hero */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-7 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-3xl flex items-center justify-center flex-shrink-0 shadow-inner">
            {group.emoji || "🌴"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                {group.name}
              </h1>
              {isAdmin && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 text-white uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
            {group.description && (
              <p className="text-xs text-slate-500 mt-1 max-w-lg">
                {group.description}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-medium">
              <span>{group.members.length} members</span>
              <span>•</span>
              <span>{expenses.length} expenses recorded</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setEditingExpense(null);
              setExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-vivid text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>

          <button
            onClick={() => {
              setDefaultSettleRecipient(undefined);
              setDefaultSettleAmount(undefined);
              setSettleModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl btn-secondary text-xs"
          >
            <HandCoins className="w-4 h-4 text-emerald-600" />
            Settle Up
          </button>

          <button
            onClick={generateShareLink}
            title="Invite link"
            className="p-2.5 rounded-xl btn-secondary text-slate-600"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl mb-6 max-w-fit overflow-x-auto border border-slate-200/60">
        {[
          { key: "expenses", label: "Expenses", icon: Receipt },
          { key: "balances", label: "Balances", icon: Scale },
          { key: "settle", label: "Who Owes Whom", icon: HandCoins },
          { key: "members", label: "Members", icon: Users },
          { key: "activity", label: "Activity", icon: History },
          { key: "charts", label: "Analytics", icon: PieChart },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-3">
          <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {Object.keys(CATEGORY_COLORS).map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0) + c.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>

              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Members</option>
                {membersList.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <button
                onClick={exportToCSV}
                title="Export CSV"
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center shadow-sm">
              <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">
                No expenses found
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 mb-4">
                Record your first shared expense to get started.
              </p>
              <button
                onClick={() => {
                  setEditingExpense(null);
                  setExpenseModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl btn-vivid text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Expense
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredExpenses.map((exp) => {
                const userSplit = exp.splits.find((s: any) => s.userId === currentUserId);
                const userPaid = exp.paidById === currentUserId;

                return (
                  <div
                    key={exp.id}
                    className="card-premium p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-sm flex-shrink-0"
                        style={{
                          backgroundColor:
                            CATEGORY_COLORS[exp.category] || "#64748b",
                        }}
                      >
                        {exp.category.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">
                            {exp.description}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                            {exp.splitType}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Paid by{" "}
                          <span className="font-semibold text-slate-800">
                            {userPaid ? "You" : exp.paidBy?.name}
                          </span>{" "}
                          on {new Date(exp.date).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right">
                        <div className="text-sm font-black text-slate-900">
                          {formatMoney(exp.amount)}
                        </div>
                        <div className="text-xs font-semibold">
                          {userPaid ? (
                            <span className="text-emerald-600">
                              you lent {formatMoney(exp.amount - (userSplit?.amount || 0))}
                            </span>
                          ) : userSplit ? (
                            <span className="text-rose-600">
                              you borrowed {formatMoney(userSplit.amount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">not involved</span>
                          )}
                        </div>
                      </div>

                      {(exp.createdById === currentUserId || isAdmin) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setExpenseModalOpen(true);
                            }}
                            title="Edit"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BALANCES */}
      {activeTab === "balances" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900 mb-4">
            Group Net Balances
          </h3>
          <div className="divide-y divide-slate-100">
            {balancesData?.memberBalances?.map((mb: any) => {
              const isPositive = mb.netBalance > 0;
              const isNegative = mb.netBalance < 0;
              const isUser = mb.user.id === currentUserId;

              return (
                <div key={mb.user.id} className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
                      {mb.user.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {mb.user.name} {isUser && "(You)"}
                      </div>
                      <div className="text-xs text-slate-400">{mb.user.email}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-sm font-black ${
                        isPositive
                          ? "text-emerald-600"
                          : isNegative
                          ? "text-rose-600"
                          : "text-slate-400"
                      }`}
                    >
                      {isPositive
                        ? `gets back ${formatMoney(mb.netBalance)}`
                        : isNegative
                        ? `owes ${formatMoney(Math.abs(mb.netBalance))}`
                        : "settled up"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: WHO OWES WHOM */}
      {activeTab === "settle" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-extrabold text-slate-900">
              Simplified Debt Settlements
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Greedy algorithm reduces complex group debts to the minimum number of transactions.
            </p>
          </div>

          {balancesData?.simplifiedTransfers?.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl">
              <Check className="w-7 h-7 text-emerald-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-800">
                All debts settled!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {balancesData?.simplifiedTransfers?.map((t: any, idx: number) => {
                const isUserSender = t.from.id === currentUserId;
                const isUserReceiver = t.to.id === currentUserId;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-slate-900">
                        {isUserSender ? "You" : t.from.name}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold px-2 py-0.5 rounded bg-white border border-slate-200">
                        <span>pays</span>
                        <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span className="font-bold text-sm text-slate-900">
                        {isUserReceiver ? "You" : t.to.name}
                      </span>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="text-sm font-black text-emerald-600">
                        {formatMoney(t.amount)}
                      </span>
                      {isUserSender && (
                        <button
                          onClick={() => {
                            setDefaultSettleRecipient(t.to.id);
                            setDefaultSettleAmount(t.amount);
                            setSettleModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-lg btn-vivid text-xs"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MEMBERS */}
      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Add Member by Email
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Existing users will be added directly; new users will get a pending invite.
            </p>

            <form onSubmit={handleAddMember} className="flex gap-2 max-w-md">
              <input
                type="email"
                required
                placeholder="friend@domain.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={addingMember}
                className="px-4 py-2 rounded-xl btn-vivid text-xs"
              >
                {addingMember ? "Adding..." : "Add"}
              </button>
            </form>
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Group Members ({group.members.length})
            </h3>
            <div className="divide-y divide-slate-100">
              {group.members.map((m: any) => {
                const isUser = m.user.id === currentUserId;
                const isMemberAdmin = m.role === "ADMIN";

                return (
                  <div key={m.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs uppercase">
                        {m.user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span>{m.user.name}</span>
                          {isMemberAdmin && (
                            <span className="text-[9px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              ADMIN
                            </span>
                          )}
                          {isUser && (
                            <span className="text-[9px] text-emerald-600 font-bold">
                              (You)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">{m.user.email}</div>
                      </div>
                    </div>

                    <div>
                      {isUser && !isMemberAdmin && (
                        <button
                          onClick={() => handleRemoveMember(m.user.id, true)}
                          className="text-xs text-rose-600 hover:underline font-semibold"
                        >
                          Leave
                        </button>
                      )}
                      {isAdmin && !isUser && (
                        <button
                          onClick={() => handleRemoveMember(m.user.id, false)}
                          className="text-xs text-rose-600 hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY */}
      {activeTab === "activity" && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900 mb-4">
            Recent Activity
          </h3>
          {activities.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No activity recorded yet.
            </p>
          ) : (
            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
              {activities.map((act) => (
                <div key={act.id} className="relative">
                  <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-white bg-emerald-600" />
                  <div className="text-xs font-medium text-slate-700">
                    <span className="font-bold text-slate-950">
                      {act.actor?.name || "Someone"}
                    </span>{" "}
                    {act.type === "EXPENSE_CREATED" &&
                      `added expense "${act.payload?.description}" for ${formatMoney(
                        act.payload?.amount || 0
                      )}`}
                    {act.type === "EXPENSE_UPDATED" &&
                      `updated "${act.payload?.description}"`}
                    {act.type === "EXPENSE_DELETED" &&
                      `deleted "${act.payload?.description}"`}
                    {act.type === "SETTLEMENT_CREATED" &&
                      `paid ${formatMoney(act.payload?.amount || 0)} to ${
                        act.payload?.toUserName || "someone"
                      }`}
                    {act.type === "MEMBER_JOINED" && "joined the group"}
                    {act.type === "MEMBER_REMOVED" && "left the group"}
                    {act.type === "GROUP_UPDATED" && "updated group info"}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(act.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: CHARTS */}
      {activeTab === "charts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 mb-3">
              Distribution by Category
            </h3>
            {pieData.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No expense data available.
              </p>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`₹${val}`, "Spent"]} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm">
            <h3 className="text-xs font-bold text-slate-900 mb-3">
              Category Totals (₹ INR)
            </h3>
            {pieData.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No expense data available.
              </p>
            ) : (
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip formatter={(val: any) => [`₹${val}`, "Amount"]} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expense Modal */}
      <ExpenseModal
        groupId={groupId}
        members={membersList}
        currentUserId={currentUserId}
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        onSuccess={fetchAllData}
        initialData={editingExpense}
      />

      {/* Settlement Modal */}
      <SettleModal
        groupId={groupId}
        members={membersList}
        currentUserId={currentUserId}
        isOpen={settleModalOpen}
        onClose={() => setSettleModalOpen(false)}
        onSuccess={fetchAllData}
        defaultRecipientId={defaultSettleRecipient}
        defaultAmountPaise={defaultSettleAmount}
      />
    </div>
  );
}
