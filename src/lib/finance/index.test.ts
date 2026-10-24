import { describe, it, expect } from "vitest";
import {
  formatMoney,
  parseMoney,
  splitEqual,
  splitByPercent,
  splitByShares,
  validateExactSplit,
  computeNetBalances,
  simplifyDebts,
} from "./index";

describe("splitEqual", () => {
  it("splits 100.00 (10000 paise) exactly 3 ways without losing a paisa", () => {
    const participants = ["u1", "u2", "u3"];
    const splits = splitEqual(10000, participants);

    const values = Object.values(splits);
    const sum = values.reduce((a, b) => a + b, 0);

    expect(sum).toBe(10000);
    // 10000 / 3 = 3333 with 1 remainder => two get 3333, one gets 3334
    expect(values.sort()).toEqual([3333, 3333, 3334]);
  });

  it("splits evenly when divisible", () => {
    const splits = splitEqual(9000, ["u1", "u2", "u3"]);
    expect(splits).toEqual({ u1: 3000, u2: 3000, u3: 3000 });
  });

  it("throws error for empty participants", () => {
    expect(() => splitEqual(1000, [])).toThrow("Cannot split between zero participants");
  });
});

describe("splitByPercent", () => {
  it("splits by percent that doesn't divide evenly with exact sum (largest remainder)", () => {
    // 100.00 paise with 33.33%, 33.33%, 33.34%
    const total = 10000;
    const percentages = { u1: 33.33, u2: 33.33, u3: 33.34 };
    const splits = splitByPercent(total, percentages);

    const sum = Object.values(splits).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
  });

  it("throws error when percentages do not sum to 100", () => {
    expect(() => splitByPercent(10000, { u1: 50, u2: 40 })).toThrow(/must sum to 100%/);
  });
});

describe("splitByShares", () => {
  it("splits 2:1:1 proportionally with exact sum", () => {
    const total = 10000;
    const shares = { u1: 2, u2: 1, u3: 1 };
    const splits = splitByShares(total, shares);

    const sum = Object.values(splits).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
    expect(splits["u1"]).toBe(5000);
    expect(splits["u2"]).toBe(2500);
    expect(splits["u3"]).toBe(2500);
  });

  it("handles non-divisible shares (e.g. 1:1:1 for 10000 paise)", () => {
    const splits = splitByShares(10000, { u1: 1, u2: 1, u3: 1 });
    const sum = Object.values(splits).reduce((a, b) => a + b, 0);
    expect(sum).toBe(10000);
  });
});

describe("validateExactSplit", () => {
  it("validates exact splits matching total", () => {
    const result = validateExactSplit(10000, { u1: 4000, u2: 6000 });
    expect(result.isValid).toBe(true);
    expect(result.difference).toBe(0);
  });

  it("detects discrepancy when under or over allocated", () => {
    const resultUnder = validateExactSplit(10000, { u1: 4000, u2: 5000 });
    expect(resultUnder.isValid).toBe(false);
    expect(resultUnder.difference).toBe(1000);

    const resultOver = validateExactSplit(10000, { u1: 6000, u2: 5000 });
    expect(resultOver.isValid).toBe(false);
    expect(resultOver.difference).toBe(-1000);
  });
});

describe("computeNetBalances", () => {
  it("sum of all net balances in a group is always exactly zero", () => {
    const expenses = [
      { id: "e1", paidById: "alice", amount: 6000 },
      { id: "e2", paidById: "bob", amount: 3000 },
    ];
    const splits = [
      { expenseId: "e1", userId: "alice", amount: 2000 },
      { expenseId: "e1", userId: "bob", amount: 2000 },
      { expenseId: "e1", userId: "charlie", amount: 2000 },
      { expenseId: "e2", userId: "alice", amount: 1000 },
      { expenseId: "e2", userId: "bob", amount: 1000 },
      { expenseId: "e2", userId: "charlie", amount: 1000 },
    ];
    const settlements = [
      { fromUserId: "charlie", toUserId: "alice", amount: 1500 },
    ];

    const nets = computeNetBalances(expenses, splits, settlements, ["alice", "bob", "charlie"]);

    const sum = Object.values(nets).reduce((a, b) => a + b, 0);
    expect(sum).toBe(0);

    // Alice: paid 6000 - shares (2000+1000) - received 1500 = +1500
    expect(nets["alice"]).toBe(1500);
    // Bob: paid 3000 - shares (2000+1000) = 0
    expect(nets["bob"]).toBe(0);
    // Charlie: paid 0 - shares (2000+1000) + paid 1500 = -1500
    expect(nets["charlie"]).toBe(-1500);
  });
});

describe("simplifyDebts", () => {
  it("simplifies debts and returns transfers bringing all balances to zero", () => {
    const netBalances = {
      alice: 4000,
      bob: 2000,
      charlie: -3000,
      david: -3000,
    };

    const transfers = simplifyDebts(netBalances);

    // Max transfers <= nonZeroUsers - 1 = 4 - 1 = 3
    expect(transfers.length).toBeLessThanOrEqual(3);

    // Verify transfers bring balances to zero
    const afterBalances: Record<string, number> = { ...netBalances };
    for (const t of transfers) {
      afterBalances[t.from] += t.amount;
      afterBalances[t.to] -= t.amount;
    }

    for (const val of Object.values(afterBalances)) {
      expect(val).toBe(0);
    }
  });

  it("handles circular debts gracefully with minimum transactions", () => {
    // 3 users where each owes the next 1000 => net balance is 0 for everyone
    const netBalances = { u1: 0, u2: 0, u3: 0 };
    const transfers = simplifyDebts(netBalances);
    expect(transfers).toEqual([]);
  });
});

describe("formatMoney and parseMoney", () => {
  it("formats paise correctly with Indian rupee symbol", () => {
    expect(formatMoney(10000)).toBe("₹100.00");
    expect(formatMoney(123450)).toBe("₹1,234.50");
    expect(formatMoney(50)).toBe("₹0.50");
    expect(formatMoney(-5000)).toBe("-₹50.00");
  });

  it("parses valid rupee strings into integer paise safely", () => {
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("12.50")).toBe(1250);
    expect(parseMoney("₹12.50")).toBe(1250);
    expect(parseMoney(12.5)).toBe(1250);
  });

  it("rejects invalid inputs, negative numbers, and more than 2 decimal places", () => {
    expect(() => parseMoney("-12")).toThrow(/Negative amounts are not allowed/);
    expect(() => parseMoney("12.999")).toThrow(/Invalid money format/);
    expect(() => parseMoney("abc")).toThrow(/Invalid money format/);
    expect(() => parseMoney("")).toThrow(/Money amount cannot be empty/);
  });
});
