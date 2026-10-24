/**
 * Core Financial Business Logic for SplitEase
 * 
 * Rules:
 * - All monetary values are integer paise (1 INR = 100 paise)
 * - Pure functions, zero database / I/O side effects
 * - Splits must sum EXACTLY to totalPaise without any lost or extra paise
 */

export interface SplitResult {
  [userId: string]: number; // userId -> amount in paise
}

/**
 * 6.7 formatMoney(paise): "₹1,234.50" using Intl.NumberFormat("en-IN")
 */
export function formatMoney(paise: number): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = absPaise / 100;

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * 6.7 parseMoney(string): converts user input to paise safely
 * Handles "12", "12.5", "12.50", rejects >2 decimals, negatives, NaN
 */
export function parseMoney(input: string | number): number {
  if (typeof input === "number") {
    if (isNaN(input) || !isFinite(input) || input < 0) {
      throw new Error("Invalid money amount");
    }
    return Math.round(input * 100);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Money amount cannot be empty");
  }

  // Reject negative signs
  if (trimmed.startsWith("-")) {
    throw new Error("Negative amounts are not allowed");
  }

  // Remove optional currency symbol ₹ or whitespace
  const sanitized = trimmed.replace(/^₹\s*/, "");

  // Match standard numbers with at most 2 decimal places
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(sanitized)) {
    throw new Error("Invalid money format. Must be a positive number with at most 2 decimal places");
  }

  const [whole, decimal = ""] = sanitized.split(".");
  const paiseWhole = parseInt(whole, 10) * 100;
  const paiseDec = parseInt(decimal.padEnd(2, "0"), 10);

  return paiseWhole + paiseDec;
}

/**
 * 6.1 splitEqual(totalPaise, participantIds):
 * - base = floor(total / n); remainder = total % n
 * - Give 1 extra paisa to the first `remainder` participants (sorted by id for determinism)
 *   so the shares sum EXACTLY to totalPaise.
 */
export function splitEqual(totalPaise: number, participantIds: string[]): SplitResult {
  if (participantIds.length === 0) {
    throw new Error("Cannot split between zero participants");
  }
  if (totalPaise < 0) {
    throw new Error("Total amount cannot be negative");
  }

  // Sort participant IDs for determinism
  const sortedIds = [...participantIds].sort();
  const n = sortedIds.length;
  const base = Math.floor(totalPaise / n);
  const remainder = totalPaise % n;

  const result: SplitResult = {};
  for (let i = 0; i < n; i++) {
    result[sortedIds[i]] = base + (i < remainder ? 1 : 0);
  }

  return result;
}

/**
 * 6.2 splitByPercent(totalPaise, {userId: percent}):
 * - Percentages must sum to 100 (allow 2 decimals).
 * - Compute floor shares, then distribute leftover paise to the largest fractional remainders
 *   so the sum is exact.
 */
export function splitByPercent(
  totalPaise: number,
  percentMap: Record<string, number>
): SplitResult {
  const userIds = Object.keys(percentMap);
  if (userIds.length === 0) {
    throw new Error("No participants provided");
  }
  if (totalPaise < 0) {
    throw new Error("Total amount cannot be negative");
  }

  // Validate percentages sum to 100 (within floating point precision tolerance 0.01)
  const totalPercent = userIds.reduce((sum, uid) => sum + percentMap[uid], 0);
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100%. Got ${totalPercent}%`);
  }

  // Calculate raw fractional paise shares
  const shares: { id: string; floor: number; remainder: number }[] = [];
  let sumFloor = 0;

  for (const uid of userIds) {
    const rawPaise = (totalPaise * percentMap[uid]) / 100;
    const floor = Math.floor(rawPaise);
    const remainder = rawPaise - floor;
    shares.push({ id: uid, floor, remainder });
    sumFloor += floor;
  }

  let leftover = totalPaise - sumFloor;

  // Sort by remainder descending, break ties by ID ascending
  shares.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  const result: SplitResult = {};
  for (let i = 0; i < shares.length; i++) {
    const extra = leftover > 0 ? 1 : 0;
    result[shares[i].id] = shares[i].floor + extra;
    if (leftover > 0) leftover--;
  }

  return result;
}

/**
 * 6.3 splitByShares(totalPaise, {userId: units}):
 * - Proportional split using the same largest-remainder method.
 */
export function splitByShares(
  totalPaise: number,
  sharesMap: Record<string, number>
): SplitResult {
  const userIds = Object.keys(sharesMap);
  if (userIds.length === 0) {
    throw new Error("No participants provided");
  }
  if (totalPaise < 0) {
    throw new Error("Total amount cannot be negative");
  }

  const totalUnits = userIds.reduce((sum, uid) => {
    const u = sharesMap[uid];
    if (u < 0) throw new Error("Share units cannot be negative");
    return sum + u;
  }, 0);

  if (totalUnits === 0) {
    throw new Error("Total share units must be greater than 0");
  }

  const calculated: { id: string; floor: number; remainder: number }[] = [];
  let sumFloor = 0;

  for (const uid of userIds) {
    const rawPaise = (totalPaise * sharesMap[uid]) / totalUnits;
    const floor = Math.floor(rawPaise);
    const remainder = rawPaise - floor;
    calculated.push({ id: uid, floor, remainder });
    sumFloor += floor;
  }

  let leftover = totalPaise - sumFloor;

  calculated.sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 1e-9) {
      return b.remainder - a.remainder;
    }
    return a.id.localeCompare(b.id);
  });

  const result: SplitResult = {};
  for (let i = 0; i < calculated.length; i++) {
    const extra = leftover > 0 ? 1 : 0;
    result[calculated[i].id] = calculated[i].floor + extra;
    if (leftover > 0) leftover--;
  }

  return result;
}

/**
 * 6.4 validateExactSplit(totalPaise, {userId: paise}): sum must equal total
 */
export function validateExactSplit(
  totalPaise: number,
  exactMap: Record<string, number>
): { isValid: boolean; difference: number } {
  const userIds = Object.keys(exactMap);
  let sum = 0;
  for (const uid of userIds) {
    const amount = exactMap[uid];
    if (amount < 0) {
      return { isValid: false, difference: totalPaise - sum };
    }
    sum += amount;
  }
  return {
    isValid: sum === totalPaise,
    difference: totalPaise - sum,
  };
}

/**
 * 6.5 computeNetBalances(expenses, splits, settlements):
 * - For each user:
 *   net = (sum of expenses they paid) - (sum of their splits) + (settlements they paid) - (settlements they received)
 * - Positive = is owed money; Negative = owes money.
 * - Invariant: Sum of all net balances in a group must equal 0.
 */
export interface ExpenseData {
  id: string;
  paidById: string;
  amount: number; // in paise
}

export interface SplitData {
  expenseId: string;
  userId: string;
  amount: number; // in paise
}

export interface SettlementData {
  fromUserId: string;
  toUserId: string;
  amount: number; // in paise
}

export function computeNetBalances(
  expenses: ExpenseData[],
  splits: SplitData[],
  settlements: SettlementData[],
  allMemberIds?: string[]
): Record<string, number> {
  const netBalances: Record<string, number> = {};

  // Ensure all known members exist in the map
  if (allMemberIds) {
    for (const uid of allMemberIds) {
      netBalances[uid] = 0;
    }
  }

  // 1. Credit paid expenses
  for (const exp of expenses) {
    netBalances[exp.paidById] = (netBalances[exp.paidById] || 0) + exp.amount;
  }

  // 2. Debit user splits
  for (const sp of splits) {
    netBalances[sp.userId] = (netBalances[sp.userId] || 0) - sp.amount;
  }

  // 3. Settlements: fromUser paid toUser
  // fromUser's net balance improves (+ paid out), toUser's net balance decreases (- received money)
  for (const st of settlements) {
    netBalances[st.fromUserId] = (netBalances[st.fromUserId] || 0) + st.amount;
    netBalances[st.toUserId] = (netBalances[st.toUserId] || 0) - st.amount;
  }

  return netBalances;
}

/**
 * 6.6 simplifyDebts(netBalances):
 * - Separate creditors (net > 0) and debtors (net < 0).
 * - Greedy algorithm: pick largest debtor and largest creditor, transfer min(|debt|, credit),
 *   record {from, to, amount}, update both, until all nets are 0.
 * - Guarantees at most (number of non-zero users - 1) transactions.
 */
export interface Transfer {
  from: string;
  to: string;
  amount: number; // in paise
}

export function simplifyDebts(netBalances: Record<string, number>): Transfer[] {
  // Separate into debtors and creditors
  // debtor: net < 0 (owes |net|)
  // creditor: net > 0 (owed net)
  interface Person {
    id: string;
    balance: number;
  }

  const debtors: Person[] = [];
  const creditors: Person[] = [];

  for (const [id, net] of Object.entries(netBalances)) {
    if (net < 0) {
      debtors.push({ id, balance: -net }); // store debt as positive
    } else if (net > 0) {
      creditors.push({ id, balance: net });
    }
  }

  const transfers: Transfer[] = [];

  while (debtors.length > 0 && creditors.length > 0) {
    // Sort debtors and creditors descending by balance
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const largestDebtor = debtors[0];
    const largestCreditor = creditors[0];

    const settleAmount = Math.min(largestDebtor.balance, largestCreditor.balance);

    if (settleAmount > 0) {
      transfers.push({
        from: largestDebtor.id,
        to: largestCreditor.id,
        amount: settleAmount,
      });

      largestDebtor.balance -= settleAmount;
      largestCreditor.balance -= settleAmount;
    }

    if (largestDebtor.balance === 0) {
      debtors.shift();
    }
    if (largestCreditor.balance === 0) {
      creditors.shift();
    }
  }

  return transfers;
}
