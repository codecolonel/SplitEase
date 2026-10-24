import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(60, "Name too long"),
  description: z.string().max(250).optional(),
  emoji: z.string().max(10).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
});

export const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required").max(100),
  amount: z.number().int().positive("Amount must be greater than 0"), // paise
  date: z.string().or(z.date()),
  category: z.enum([
    "FOOD",
    "TRAVEL",
    "RENT",
    "GROCERIES",
    "UTILITIES",
    "ENTERTAINMENT",
    "SHOPPING",
    "HEALTH",
    "OTHER",
  ]),
  paidById: z.string().min(1, "Payer is required"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENT", "SHARES"]),
  receiptUrl: z.string().url().optional().or(z.literal("")),
  splits: z.array(
    z.object({
      userId: z.string(),
      amount: z.number().int().nonnegative(),
      meta: z.any().optional(),
    })
  ).min(1, "At least one participant required"),
});

export const createSettlementSchema = z.object({
  toUserId: z.string().min(1, "Recipient is required"),
  amount: z.number().int().positive("Settlement amount must be positive"), // paise
  date: z.string().or(z.date()).optional(),
  note: z.string().max(150).optional(),
});
