"use client";

import { useState } from "react";
import { formatMoney, parseMoney, splitEqual, splitByPercent, splitByShares } from "@/lib/finance";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Member {
  id: string;
  name: string;
  email: string;
}

interface ExpenseModalProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

const CATEGORIES = [
  "FOOD",
  "TRAVEL",
  "RENT",
  "GROCERIES",
  "UTILITIES",
  "ENTERTAINMENT",
  "SHOPPING",
  "HEALTH",
  "OTHER",
];

export function ExpenseModal({
  groupId,
  members,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: ExpenseModalProps) {
  const { showToast } = useToast();
  const [description, setDescription] = useState(initialData?.description || "");
  const [amountStr, setAmountStr] = useState(
    initialData ? (initialData.amount / 100).toString() : ""
  );
  const [date, setDate] = useState(
    initialData?.date
      ? new Date(initialData.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [category, setCategory] = useState(initialData?.category || "FOOD");
  const [paidById, setPaidById] = useState(initialData?.paidById || currentUserId);
  const [splitType, setSplitType] = useState<"EQUAL" | "EXACT" | "PERCENT" | "SHARES">(
    initialData?.splitType || "EQUAL"
  );
  const [receiptUrl, setReceiptUrl] = useState(initialData?.receiptUrl || "");
  const [submitting, setSubmitting] = useState(false);

  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    if (initialData?.splits) {
      return initialData.splits.map((s: any) => s.userId);
    }
    return members.map((m) => m.id);
  });

  const [exactInputs, setExactInputs] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    if (initialData?.splits && initialData.splitType === "EXACT") {
      initialData.splits.forEach((s: any) => {
        res[s.userId] = (s.amount / 100).toString();
      });
    }
    return res;
  });

  const [percentInputs, setPercentInputs] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    if (initialData?.splits && initialData.splitType === "PERCENT") {
      initialData.splits.forEach((s: any) => {
        res[s.userId] = s.meta?.percent?.toString() || "";
      });
    }
    return res;
  });

  const [sharesInputs, setSharesInputs] = useState<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    if (initialData?.splits && initialData.splitType === "SHARES") {
      initialData.splits.forEach((s: any) => {
        res[s.userId] = s.meta?.shares?.toString() || "1";
      });
    } else {
      members.forEach((m) => {
        res[m.id] = "1";
      });
    }
    return res;
  });

  if (!isOpen) return null;

  let parsedPaise = 0;
  try {
    parsedPaise = parseMoney(amountStr);
  } catch {
    parsedPaise = 0;
  }

  let computedSplits: { userId: string; amount: number; meta?: any }[] = [];
  let remainingPaise = 0;
  let validationError = "";

  if (parsedPaise > 0 && selectedMembers.length > 0) {
    if (splitType === "EQUAL") {
      const splitMap = splitEqual(parsedPaise, selectedMembers);
      computedSplits = Object.entries(splitMap).map(([userId, amount]) => ({
        userId,
        amount,
      }));
      remainingPaise = 0;
    } else if (splitType === "EXACT") {
      let allocated = 0;
      for (const uid of selectedMembers) {
        const val = exactInputs[uid];
        let p = 0;
        try {
          p = val ? parseMoney(val) : 0;
        } catch {
          p = 0;
        }
        allocated += p;
        computedSplits.push({ userId: uid, amount: p });
      }
      remainingPaise = parsedPaise - allocated;
      if (remainingPaise !== 0) {
        validationError = `Exact splits must sum to ${formatMoney(parsedPaise)}. Remaining: ${formatMoney(remainingPaise)}`;
      }
    } else if (splitType === "PERCENT") {
      let sumPercent = 0;
      const pctMap: Record<string, number> = {};
      for (const uid of selectedMembers) {
        const p = parseFloat(percentInputs[uid] || "0");
        pctMap[uid] = p;
        sumPercent += p;
      }
      const pctRemaining = 100 - sumPercent;
      if (Math.abs(pctRemaining) > 0.01) {
        validationError = `Percentages must sum to 100%. Remaining: ${pctRemaining}%`;
      } else {
        const splitMap = splitByPercent(parsedPaise, pctMap);
        computedSplits = Object.entries(splitMap).map(([userId, amount]) => ({
          userId,
          amount,
          meta: { percent: pctMap[userId] },
        }));
      }
    } else if (splitType === "SHARES") {
      const sMap: Record<string, number> = {};
      let totalUnits = 0;
      for (const uid of selectedMembers) {
        const u = parseFloat(sharesInputs[uid] || "0");
        sMap[uid] = u;
        totalUnits += u;
      }
      if (totalUnits <= 0) {
        validationError = "Total share units must be greater than 0";
      } else {
        const splitMap = splitByShares(parsedPaise, sMap);
        computedSplits = Object.entries(splitMap).map(([userId, amount]) => ({
          userId,
          amount,
          meta: { shares: sMap[userId] },
        }));
      }
    }
  }

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      showToast("Please enter an expense description", "error");
      return;
    }

    if (parsedPaise <= 0) {
      showToast("Amount must be greater than 0", "error");
      return;
    }

    if (selectedMembers.length === 0) {
      showToast("Select at least one participant", "error");
      return;
    }

    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    const payload = {
      description,
      amount: parsedPaise,
      date,
      category,
      paidById,
      splitType,
      receiptUrl: receiptUrl.trim() || undefined,
      splits: computedSplits,
    };

    try {
      setSubmitting(true);
      const url = initialData?.id
        ? `/api/expenses/${initialData.id}`
        : `/api/groups/${groupId}/expenses`;
      const method = initialData?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok) {
        showToast(
          initialData ? "Expense updated" : "Expense recorded",
          "success"
        );
        onSuccess();
        onClose();
      } else {
        showToast(json.error?.message || "Failed to save expense", "error");
      }
    } catch (err) {
      showToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-slate-900">
            {initialData ? "Edit Expense" : "Record Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner, Grocery run"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Amount (₹ INR) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-xs">₹</span>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Paid By
              </label>
              <select
                value={paidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.id === currentUserId ? "(You)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Split Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { type: "EQUAL", label: "Equally" },
                { type: "EXACT", label: "Exact (₹)" },
                { type: "PERCENT", label: "% Percent" },
                { type: "SHARES", label: "Shares" },
              ].map(({ type, label }) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSplitType(type as any)}
                  className={`py-2 text-xs font-bold rounded-xl border transition ${
                    splitType === type
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2.5">
              <span>PARTICIPANTS ({selectedMembers.length})</span>
              {validationError && (
                <span className="text-rose-600 font-semibold text-[11px]">
                  {validationError}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {members.map((m) => {
                const isSelected = selectedMembers.includes(m.id);
                const computed = computedSplits.find((s) => s.userId === m.id);

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white border border-slate-200"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(m.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        {m.name} {m.id === currentUserId ? "(You)" : ""}
                      </span>
                    </label>

                    {isSelected && (
                      <div className="flex items-center gap-2">
                        {splitType === "EXACT" && (
                          <input
                            type="text"
                            placeholder="0.00"
                            value={exactInputs[m.id] || ""}
                            onChange={(e) =>
                              setExactInputs({ ...exactInputs, [m.id]: e.target.value })
                            }
                            className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200 text-right"
                          />
                        )}

                        {splitType === "PERCENT" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="0"
                              value={percentInputs[m.id] || ""}
                              onChange={(e) =>
                                setPercentInputs({ ...percentInputs, [m.id]: e.target.value })
                              }
                              className="w-12 px-2 py-1 text-xs rounded-lg border border-slate-200 text-right"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </div>
                        )}

                        {splitType === "SHARES" && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={sharesInputs[m.id] || "1"}
                              onChange={(e) =>
                                setSharesInputs({ ...sharesInputs, [m.id]: e.target.value })
                              }
                              className="w-12 px-2 py-1 text-xs rounded-lg border border-slate-200 text-right"
                            />
                            <span className="text-xs text-slate-400">units</span>
                          </div>
                        )}

                        <span className="text-xs font-bold text-emerald-600 min-w-16 text-right">
                          {computed ? formatMoney(computed.amount) : "₹0.00"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(validationError)}
              className="px-5 py-2.5 rounded-xl btn-vivid text-xs"
            >
              {submitting ? "Saving..." : initialData ? "Update" : "Save Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
