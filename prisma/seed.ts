import { PrismaClient, Role, SplitType, Category, ActivityType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.activity.deleteMany({});
  await prisma.settlement.deleteMany({});
  await prisma.expenseSplit.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.groupInvite.deleteMany({});
  await prisma.groupMember.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash("Demo@1234", 10);

  // 1. Create 3 demo users
  const demoUser = await prisma.user.create({
    data: {
      name: "Demo User",
      email: "demo@splitease.app",
      passwordHash,
    },
  });

  const rahul = await prisma.user.create({
    data: {
      name: "Rahul Sharma",
      email: "rahul@splitease.app",
      passwordHash,
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: "Priya Patel",
      email: "priya@splitease.app",
      passwordHash,
    },
  });

  console.log("Created users:", demoUser.email, rahul.email, priya.email);

  // 2. Create 1 demo group: "Goa Trip 2026"
  const group = await prisma.group.create({
    data: {
      name: "Goa Beach Villa 🌴",
      description: "Weekend road trip and villa stay with friends",
      emoji: "🌴",
      createdById: demoUser.id,
      members: {
        create: [
          { userId: demoUser.id, role: Role.ADMIN },
          { userId: rahul.id, role: Role.MEMBER },
          { userId: priya.id, role: Role.MEMBER },
        ],
      },
    },
  });

  console.log("Created group:", group.name);

  // 3. Add ~8 expenses of mixed split types
  // Expense 1: Villa Booking - 15,000 INR (1,500,000 paise) - EQUAL split 3 ways (5000 each)
  const exp1 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Villa Booking (2 nights)",
      amount: 1500000,
      category: Category.RENT,
      paidById: demoUser.id,
      createdById: demoUser.id,
      splitType: SplitType.EQUAL,
      date: new Date(Date.now() - 4 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 500000 },
          { userId: rahul.id, amount: 500000 },
          { userId: priya.id, amount: 500000 },
        ],
      },
    },
  });

  // Expense 2: Seafood Dinner - 4,500 INR (450,000 paise) - EQUAL split 3 ways (1500 each)
  const exp2 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Beach Shack Seafood Dinner",
      amount: 450000,
      category: Category.FOOD,
      paidById: rahul.id,
      createdById: rahul.id,
      splitType: SplitType.EQUAL,
      date: new Date(Date.now() - 3 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 150000 },
          { userId: rahul.id, amount: 150000 },
          { userId: priya.id, amount: 150000 },
        ],
      },
    },
  });

  // Expense 3: Car Rental & Fuel - 6,000 INR (600,000 paise) - EXACT split
  // demoUser paid 6000. Splits: demoUser: 2000, rahul: 2500, priya: 1500
  const exp3 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Self-drive SUV Rental & Fuel",
      amount: 600000,
      category: Category.TRAVEL,
      paidById: demoUser.id,
      createdById: demoUser.id,
      splitType: SplitType.EXACT,
      date: new Date(Date.now() - 3 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 200000 },
          { userId: rahul.id, amount: 250000 },
          { userId: priya.id, amount: 150000 },
        ],
      },
    },
  });

  // Expense 4: Supermarket & Drinks - 3,250 INR (325,000 paise) - PERCENT split
  // Priya paid 3250. Splits: Demo: 40%, Rahul: 40%, Priya: 20%
  // 40% of 325000 = 130000, 40% = 130000, 20% = 65000
  const exp4 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Groceries & Refreshments",
      amount: 325000,
      category: Category.GROCERIES,
      paidById: priya.id,
      createdById: priya.id,
      splitType: SplitType.PERCENT,
      date: new Date(Date.now() - 2 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 130000, meta: { percent: 40 } },
          { userId: rahul.id, amount: 130000, meta: { percent: 40 } },
          { userId: priya.id, amount: 65000, meta: { percent: 20 } },
        ],
      },
    },
  });

  // Expense 5: Scuba Diving & Water Sports - 9,000 INR (900,000 paise) - SHARES split (2:1:0 or 2:1:1)
  // Demo paid 9000. Rahul: 2 shares, Demo: 1 share, Priya: 0 (did not participate).
  // Total 3 shares. Rahul = 6000, Demo = 3000.
  const exp5 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Scuba Diving & Jet Ski",
      amount: 900000,
      category: Category.ENTERTAINMENT,
      paidById: demoUser.id,
      createdById: demoUser.id,
      splitType: SplitType.SHARES,
      date: new Date(Date.now() - 2 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 300000, meta: { shares: 1 } },
          { userId: rahul.id, amount: 600000, meta: { shares: 2 } },
        ],
      },
    },
  });

  // Expense 6: Cafe Breakfast - 1,200 INR (120,000 paise) - EQUAL split
  // Priya paid 1200. Equal split 3 ways (400 each)
  const exp6 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "French Bakery Breakfast",
      amount: 120000,
      category: Category.FOOD,
      paidById: priya.id,
      createdById: priya.id,
      splitType: SplitType.EQUAL,
      date: new Date(Date.now() - 1 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 40000 },
          { userId: rahul.id, amount: 40000 },
          { userId: priya.id, amount: 40000 },
        ],
      },
    },
  });

  // Expense 7: Highway Tolls - 450 INR (45,000 paise) - EQUAL split 3 ways (150 each)
  const exp7 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Fastag Highway Tolls",
      amount: 45000,
      category: Category.TRAVEL,
      paidById: rahul.id,
      createdById: rahul.id,
      splitType: SplitType.EQUAL,
      date: new Date(Date.now() - 1 * 86400000),
      splits: {
        create: [
          { userId: demoUser.id, amount: 15000 },
          { userId: rahul.id, amount: 15000 },
          { userId: priya.id, amount: 15000 },
        ],
      },
    },
  });

  // Expense 8: First Aid & Sunscreen - 850 INR (85,000 paise) - EXACT split
  // Demo paid 850. Demo: 250, Priya: 600
  const exp8 = await prisma.expense.create({
    data: {
      groupId: group.id,
      description: "Pharmacy & Sunscreen Lotion",
      amount: 85000,
      category: Category.HEALTH,
      paidById: demoUser.id,
      createdById: demoUser.id,
      splitType: SplitType.EXACT,
      date: new Date(),
      splits: {
        create: [
          { userId: demoUser.id, amount: 25000 },
          { userId: priya.id, amount: 60000 },
        ],
      },
    },
  });

  // 4. Record 1 Settlement: Rahul paid Demo User 3,000 INR (300,000 paise)
  const settlement = await prisma.settlement.create({
    data: {
      groupId: group.id,
      fromUserId: rahul.id,
      toUserId: demoUser.id,
      amount: 300000,
      note: "Partial settlement via UPI for villa & rental",
      date: new Date(),
    },
  });

  // 5. Add initial activity items
  await prisma.activity.createMany({
    data: [
      {
        groupId: group.id,
        actorId: demoUser.id,
        type: ActivityType.EXPENSE_CREATED,
        payload: { description: "Villa Booking (2 nights)", amount: 1500000 },
      },
      {
        groupId: group.id,
        actorId: rahul.id,
        type: ActivityType.EXPENSE_CREATED,
        payload: { description: "Beach Shack Seafood Dinner", amount: 450000 },
      },
      {
        groupId: group.id,
        actorId: rahul.id,
        type: ActivityType.SETTLEMENT_CREATED,
        payload: { toUserName: demoUser.name, amount: 300000 },
      },
    ],
  });

  console.log("Seeding finished successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
