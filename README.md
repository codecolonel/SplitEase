# SplitEase 💸

> **Effortless Expense Sharing for Friends, Roommates & Travel Groups**  
> Built with Next.js 14+ (App Router), TypeScript, Tailwind CSS, Prisma, PostgreSQL, and Auth.js. Default currency in Indian Rupee (₹ INR).

---

## 📌 Problem Statement
Tracking shared expenses among friends or roommates often leads to confusion, manual calculation errors, and awkward follow-ups. SplitEase solves this by providing:
- Live group balances calculated down to the exact paisa (no floating-point rounding errors).
- Flexible splits: **Equal**, **Exact**, **Percentage**, and **Shares**.
- Greedy Debt Minimization Algorithm to settle debts in the minimum possible number of transactions.
- Fast settlements, invite links, receipt storage support, and real-time activity tracking.

---

## 🚀 Key Features

### 1. Authentication & Security
- Secure credentials authentication with bcrypt (cost 10+), Auth.js JWT session strategy.
- Password validation (minimum 8 characters) and input validation via Zod schemas.
- Route protection with Next.js middleware and API authorization checks on all endpoints.

### 2. Group Management
- Create groups with custom emoji icons and descriptions.
- Dashboard with high-level summary cards (**You Are Owed**, **You Owe**, **Total Net Balance**).
- Add members directly by email or create pending shareable invite links with auto-linking upon signup.
- Permissions: Group creator is Admin (can rename group, remove members with zero balance, or delete group).
- Members can leave only when their balance is zero.

### 3. Expenses & Splits (Stored in Integer Minor Units - Paise)
- Add, edit, and delete expenses with category tags (Food, Travel, Rent, Groceries, Utilities, Entertainment, Shopping, Health, Other).
- Four distinct split strategies:
  - **EQUAL**: Distributes evenly, giving remainder paise deterministically so sums match 100%.
  - **EXACT**: Exact amount per participant with live balance feedback.
  - **PERCENT**: Percentages summing to 100% using largest-remainder distribution.
  - **SHARES**: Proportional splits (e.g. 2:1:1).
- Live validation showing remaining unallocated amount in real-time.
- Expense search and category/member filters.

### 4. Balances & "Who Owes Whom" (Greedy Simplification)
- Per-member net balance view (positive = owed money, negative = owes money).
- Simplified debt algorithm: Transforms complex multilateral debts into the minimum number of pairwise transfers ($\le N - 1$).
- Settle up directly with one click to record UPI / cash payments.
- Real-time audit activity feed logging member actions, expense changes, and settlements.

### 5. Analytics & Export
- Category spending breakdown with interactive Recharts pie chart and expense summary bar chart.
- Export all group expenses directly to clean CSV format.
- Dark mode toggle with persistent theme switching.

---

## 📐 Data Model & Architecture (Mermaid ER Diagram)

```mermaid
erDiagram
    User ||--o{ GroupMember : "has"
    User ||--o{ Expense : "pays"
    User ||--o{ ExpenseSplit : "owes"
    User ||--o{ Settlement : "sends/receives"
    User ||--o{ Activity : "triggers"
    Group ||--o{ GroupMember : "contains"
    Group ||--o{ Expense : "records"
    Group ||--o{ Settlement : "tracks"
    Group ||--o{ Activity : "logs"
    Group ||--o{ GroupInvite : "issues"
    Expense ||--o{ ExpenseSplit : "divides into"

    User {
        string id PK
        string name
        string email UK
        string passwordHash
        datetime createdAt
    }

    Group {
        string id PK
        string name
        string description
        string emoji
        string createdById FK
        datetime createdAt
    }

    GroupMember {
        string id PK
        string groupId FK
        string userId FK
        string role
        datetime joinedAt
    }

    Expense {
        string id PK
        string groupId FK
        string description
        int amount "in paise"
        string category
        string splitType
        string paidById FK
        datetime date
        datetime deletedAt
    }

    ExpenseSplit {
        string id PK
        string expenseId FK
        string userId FK
        int amount "in paise"
        json meta
    }

    Settlement {
        string id PK
        string groupId FK
        string fromUserId FK
        string toUserId FK
        int amount "in paise"
        string note
        datetime date
    }

    Activity {
        string id PK
        string groupId FK
        string actorId FK
        string type
        json payload
        datetime createdAt
    }
```

---

## 🧮 Financial & Debt Minimization Algorithm

1. **Integer Arithmetic**: All currency calculations operate on integer paise ($1\text{ INR} = 100\text{ paise}$).
2. **Net Balances**:
   $$\text{Net}_u = \sum \text{Paid Expenses} - \sum \text{Assigned Splits} + \sum \text{Settlements Sent} - \sum \text{Settlements Received}$$
   **Invariant**: $\sum_{u \in \text{Group}} \text{Net}_u = 0$.
3. **Greedy Debt Simplification**:
   - Separate group members into debtors ($\text{Net} < 0$) and creditors ($\text{Net} > 0$).
   - Repeatedly match the largest debtor with the largest creditor, transferring $\min(|\text{Debt}|, \text{Credit})$.
   - Deduct the transferred amount from both until all balances become zero. This guarantees that at most $M - 1$ transfers are made (where $M$ is the count of users with non-zero balances).

---

## 🛠 Tech Stack
- **Framework**: Next.js 14+ (App Router) with TypeScript (Strict mode)
- **Styling**: Tailwind CSS, Lucide React icons
- **Database & ORM**: PostgreSQL (Neon / Supabase), Prisma ORM
- **Authentication**: Auth.js / NextAuth (Credentials provider, bcrypt hashing, JWT)
- **Validation**: Zod (shared schemas for client & server)
- **Forms**: React Hook Form with `@hookform/resolvers/zod`
- **Charts**: Recharts
- **Testing**: Vitest (pure unit tests for `/lib/finance` algorithms)

---

## ⚡ Setup & Run Instructions

### 1. Clone & Install
```bash
git clone <repo-url>
cd splitease
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/splitease?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-random-key"
```

### 3. Setup Database & Seed Demo Data
```bash
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Unit Tests
```bash
npx vitest run
```

---

## 🔑 Demo Credentials
- **Email**: `demo@splitease.app`
- **Password**: `Demo@1234`
*(Pre-seeded with "Goa Beach Villa 🌴" group, 3 users, 8 mixed expenses, and 1 settlement)*

---

## 🚢 Deployment to Vercel
1. Push repository to GitHub.
2. Import project into [Vercel](https://vercel.com).
3. Set environment variables (`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`).
4. In build command settings, run `prisma generate && next build`.
5. Deploy!
