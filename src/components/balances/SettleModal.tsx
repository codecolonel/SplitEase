"use client";

import { useState } from "react";
import { formatMoney, parseMoney } from "@/lib/finance";
import { useToast } from "@/components/ui/Toast";

interface Member {
  id: string;
  name: string;
  email: string;
}

interface SettleModalProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultRecipientId?: string;
  defaultAmountPaise?: number;
}

export function SettleModal({
  groupId,
  members,
  currentUserId,
  isOpen,
  onClose,
  onSuccess,
  defaultRecipientId,
  defaultAmountPaise,
}: SettleModalProps) {
  const { showToast } = useToast();
  const recipients = members.filter((m) => m.id !== currentUserId);

  const [toUserId, setToUserId] = useState(
    defaultRecipientId || (recipients[0]?.id ?? "")
  );
  const [amountStr, setAmountStr] = useState(
    defaultAmountPaise ? (defaultAmountPaise / 100).toString() : ""
  );
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toUserId) {
      showToast("Please select a recipient", "error");
      return;
    }

    let parsedPaise = 0;
    try {
      parsedPaise = parseMoney(amountStr);
    } catch {
      showToast("Please enter a valid amount", "error");
      return;
    }

    if (parsedPaise <= 0) {
      showToast("Settlement amount must be positive", "error");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId,
          amount: parsedPaise,
          date,
          note: note.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        showToast("Settlement recorded successfully", "success");
        onSuccess();
        onClose();
      } else {
        showToast(json.error?.message || "Failed to record payment", "error");
      }
    } catch (err) {
      showToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <h2 className="text-base font-extrabold text-slate-900">
            Record Settlement
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Recipient
            </label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
            >
              {recipients.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Amount (₹ INR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">₹</span>
              <input
                type="text"
                required
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Payment Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI / Google Pay transfer"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl btn-vivid text-xs"
            >
              {submitting ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
