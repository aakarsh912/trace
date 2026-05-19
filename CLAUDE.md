# CLAUDE.md — Trace Project
> Read this first. Every time. This file is the single source of context for this project.
> Version: 1.1 — Updated after full document review and decision log resolution.

---

## What is Trace?

Trace is a multi-tenant B2B SaaS platform for **Environmental and Social Due Diligence (ESDD)** compliance tracking under IFC Performance Standards.

Three types of organisations collaborate on a single platform:
1. **Bank** — approves loans subject to ESDD conditions, oversees compliance
2. **Consultant** — authors the action plan, reviews loanee submissions
3. **Loanee** — the borrower, uploads evidence documents against each action

**The core loop:**
Platform Operator creates Bank workspace → Bank invites Consultant → Consultant creates project + invites Loanee → Consultant drafts and publishes Action Plan → Loanee uploads evidence per deliverable → Consultant reviews (approve or send back) → Bank monitors

---

## The Prototype

`prototype/trace.html` — a single-file HTML prototype with 57 fully interactive views.

**This is your visual and interaction bible.** Before building any screen, open it and find the corresponding view. Build to match it exactly.

Open it in a browser. Use the persona picker ("Who are you today?") to switch between Bank, Consultant, and Loanee.

**The prototype is a reference — NOT code to build on top of.** The production app is built fresh in Next.js. The prototype shows what things look like and how they behave.

---

## Personas & Seed Data

When running `npx tsx lib/db/seed.ts`, these records are created:

| Name | Email | Password | Workspace | Role |
|------|-------|----------|-----------|------|
| Arjun Krishnan | arjun@hdfccapital.com | Test1234! | HDFC Capital (bank) | Admin |
| Kavya Nair | kavya@hdfccapital.com | Test1234! | HDFC Capital (bank) | Member |
| Priya Kapoor | priya@ramboll.com | Test1234! | Ramboll Mumbai (consultant) | Admin |
| Naveen Rao | naveen@ramboll.com | Test1234! | Ramboll Mumbai (consultant) | Member |
| Meera Sharma | meera@eldeco.com | Test1234! | Eldeco Group (loanee) | Admin |
| Rahul Verma | rahul@eldeco.com | Test1234! | Eldeco Group (loanee) | Member |

**Seed project:** "Project Yamuna" — links all three workspaces, 22 Actions across IFC categories, mixed statuses for demo realism.

**Admin panel:** `http://localhost:3000/admin` — password is whatever `ADMIN_SECRET` is in `.env.local`.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14 (App Router) | Full-stack, one repo |
| Language | TypeScript strict | No `any` types, ever |
| Styling | Tailwind CSS | Utility classes only |
| Components | shadcn/ui | Copy-paste, not installed as dep |
| Database | PostgreSQL via Neon | Serverless, branching |
| ORM | Drizzle ORM | `lib/db/schema.ts` is source of truth |
| Auth | Clerk (user identity only) | See auth section below |
| File storage | Cloudflare R2 | Direct browser upload, signed URLs |
| Email | Resend + React Email | 7 templates, server-side only |
| Hosting | Vercel | Auto-deploy from GitHub |

---

## Critical: How Auth Works

**Clerk handles: login, passwords, sessions, password reset.**
**We handle: which workspace a user belongs to, their role, what they can do.**

Clerk is NOT used for Organizations or multi-tenancy. We manage that entirely in our database.

```
User logs in (Clerk verifies identity)
      ↓
Middleware gets clerk_user_id from session
      ↓
We look up: users table → workspace_members table
      ↓
We know: which workspaces this user is in, and their role in each
      ↓
We apply permissions from lib/auth/permissions.ts
```

The workspace switcher in the sidebar lets users with multiple workspaces switch without re-logging in.

**Admin panel** at `/admin` uses a completely separate auth mechanism — just a secret string in env vars (`ADMIN_SECRET`). No Clerk.

---

## Workspace Creation Chain

This is how every account in the system gets created:

```
1. YOU (Platform Operator) → /admin → create Bank workspace + enter Bank Admin email
   → Bank Admin receives invite email → clicks link → creates account

2. Bank Admin → invites Consultant firm (enters firm name + consultant admin email)
   → Consultant Admin receives invite → creates account + Consultant workspace

3. Consultant Admin → creates project → enters Loanee firm name + admin email
   → Loanee workspace created IMMEDIATELY in DB
   → Loanee Admin receives invite → creates account → sees project already there
```

There is NO public sign-up page. Every account starts with an email invite.

---

## Repository Structure

```
trace/
├── app/
│   ├── (auth)/              # Login, invite/[token], reset-password
│   ├── (dashboard)/         # Protected routes — requires Clerk session
│   │   ├── layout.tsx       # Sidebar + topbar (workspace-aware)
│   │   ├── dashboard/       # Per-persona landing page
│   │   ├── projects/        # List + [projectId]/page + actions/[actionId]/page
│   │   └── settings/        # general/ + members/
│   ├── admin/               # Platform operator panel (/admin)
│   └── api/                 # All API routes (see API section)
├── components/
│   ├── ui/                  # shadcn/ui — auto-generated, never edit manually
│   ├── layout/              # Sidebar, topbar, workspace-switcher
│   ├── projects/            # ProjectCard, CreateProjectForm
│   ├── actions/             # ActionCard, ActionDetail, ActionModal
│   ├── deliverables/        # DeliverableRow, UploadZone, ReviewControls
│   ├── comments/            # CommentThread, CommentComposer
│   └── shared/              # StatusChip, EmptyState, ActivityLog, Skeleton
├── lib/
│   ├── db/
│   │   ├── schema.ts        # THE database schema. Single source of truth.
│   │   ├── client.ts        # Drizzle + Neon client
│   │   ├── seed.ts          # Demo data for development
│   │   └── migrations/      # Auto-generated by Drizzle. Never edit manually.
│   ├── auth/
│   │   ├── clerk.ts         # getCurrentUser(), session helpers
│   │   └── permissions.ts   # can(workspaceType, role, permission) function
│   ├── email/
│   │   ├── client.ts        # Resend client
│   │   └── templates/       # React Email templates (7 required for MVP)
│   └── storage/
│       └── r2.ts            # getUploadUrl(), getDownloadUrl()
├── prototype/
│   └── trace.html           # Visual reference — open in browser
├── docs/
│   ├── PRD.md               # What to build and why
│   └── TECH_SPEC.md         # How to build it
├── middleware.ts             # Protects /dashboard routes via Clerk
├── .env.example             # Committed — template only, no real values
└── CLAUDE.md                # This file
```

---

## Database Schema (Key Tables)

Full schema in `lib/db/schema.ts`. Key concepts:

| Table | What it stores | Key columns |
|-------|---------------|-------------|
| `workspaces` | One per org (bank/consultant/loanee) | `type`, `slug` |
| `users` | Synced from Clerk webhook | `clerk_user_id`, `email` |
| `workspace_members` | Who belongs to which workspace + role | `workspace_id`, `user_id`, `role`, `joined_at` |
| `invites` | Pending email invitations | `token`, `expires_at`, `accepted_at` |
| `projects` | Links bank + consultant + loanee | `bank_workspace_id`, `consultant_workspace_id`, `loanee_workspace_id`, `is_published` |
| `actions` | ESDD actions within a project | `action_number`, `ifc_category`, `is_published` |
| `action_number_sequences` | Tracks last used number per category per project | `project_id`, `ifc_category`, `last_number` |
| `deliverables` | Measurable outcomes within an action | `letter`, `status`, `assigned_to` |
| `documents` | Uploaded files linked to deliverables | `file_key`, `version`, `is_current` |
| `reviews` | Approve/send-back decisions | `decision`, `comment` |
| `comments` | Discussion threads on actions | `body`, `deleted_at` |
| `activity_log` | Immutable audit trail | `event_type`, `entity_id`, `metadata` |

**Critical patterns:**
- Soft deletes everywhere: filter with `WHERE deleted_at IS NULL`
- Data isolation: every query filters by workspace_id
- Action status is COMPUTED (not stored) from deliverable statuses
- Documents: `is_current = TRUE` is always the version under review

---

## Permissions Model

```typescript
// lib/auth/permissions.ts
// Call can(workspaceType, role, permission) before every data operation

// Bank admin/member: read-only on all project data + can comment
// Consultant admin: full project + action plan control, can review
// Consultant member: can create/edit actions, can review deliverables
// Loanee admin: can submit docs, assign actions, invite team
// Loanee member: can submit docs, comment
```

**Non-negotiable rule: check permissions in every API route before any DB operation.**

---

## Business Rules (Non-Negotiable)

1. **Workspace type never changes** after creation
2. **Only Consultant Admin creates projects** in MVP
3. **Action plan is invisible to Loanee** until `is_published = TRUE`
4. **Loanee workspace is created immediately** when Consultant creates a project (even before invite is accepted)
5. **Action numbers are auto-generated**: format `[CATEGORY]-[N]`, sequence per category per project (PS2-1, PS2-2, PS3-1...)
6. **Action status is automatic** — never manually set in MVP. Computed from deliverable statuses.
7. **Re-uploads create new versions** — old document is never deleted. New one becomes `is_current`.
8. **Send Back requires a comment**. Approve does not.
9. **Action can only be approved when ALL deliverables are individually approved**
10. **The last Admin in a workspace cannot be removed or demoted**
11. **Comments are visible to all three workspace types** — Bank can also comment
12. **Deleted comments show "Comment deleted"** — never truly removed (audit trail)

---

## Action Status Logic

Status is NOT stored in DB for MVP. It is computed when needed:

```typescript
function computeActionStatus(deliverables: Deliverable[], isPublished: boolean): ActionStatus {
  if (!isPublished) return 'draft';
  if (deliverables.every(d => d.status === 'approved')) return 'completed';
  if (deliverables.some(d => d.status === 'sent_back')) return 'requires_attention';
  return 'in_progress';
}
```

---

## Action Number Generation

When creating an action, use a safe sequence:

```typescript
// Use UPDATE ... RETURNING to atomically increment and get the new number
// This prevents race conditions if two actions are created simultaneously
async function getNextActionNumber(projectId: string, category: IFcCategory): Promise<string> {
  const result = await db
    .insert(actionNumberSequences)
    .values({ projectId, ifcCategory: category, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [actionNumberSequences.projectId, actionNumberSequences.ifcCategory],
      set: { lastNumber: sql`${actionNumberSequences.lastNumber} + 1` }
    })
    .returning();
  
  const prefix = category.toUpperCase().replace('REGULATORY', 'RC');
  return `${prefix}-${result[0].lastNumber}`;
}
```

---

## Email Templates

7 templates required for MVP. All in `lib/email/templates/`. All use React Email.

Sender: `process.env.EMAIL_FROM` (defaults to `onboarding@resend.dev` in dev, update when domain is live).

Every email must include a **deep link** directly to the relevant item in the app using `process.env.NEXT_PUBLIC_APP_URL`.

---

## Empty States

Every list view must show an empty state component when there is no data. Reference prototype views named `view-empty-*` for exact copy and visuals.

Use the shared `EmptyState` component:
```typescript
<EmptyState
  icon={<FileIcon />}
  title="No actions yet"
  description="Draft your action plan to get started"
  action={{ label: "Add First Action", onClick: handleAddAction }}
/>
```

---

## Design System

Implement the prototype's visual design using Tailwind + CSS variables. Key tokens in `globals.css`:

```css
:root {
  --bg: #FFFFFF;
  --fg: #111111;
  --fg-secondary: #555555;
  --fg-tertiary: #999999;
  --border: #E5E5E5;
  --bg-subtle: #F8F8F8;

  /* Status */
  --status-approved-fg: #1E4B3B; --status-approved-bg: #EBF5EF;
  --status-returned-fg: #9B7400; --status-returned-bg: #FEF3C7;
  --status-submitted-fg: #2B5C8A; --status-submitted-bg: #EBF2FE;
  --status-draft-fg: #6B7280; --status-draft-bg: #F3F4F6;
  --status-attention-fg: #9B3A3A; --status-attention-bg: #FEF2F2;

  /* Workspace accents */
  --accent-bank: #2B3F6A;
  --accent-consultant: #3F3F3F;
  --accent-loanee: #1E4B3B;

  --radius: 6px;
  --radius-lg: 10px;
}
```

---

## IFC Categories (Fixed List)

Do not allow custom categories in MVP. These are the only valid values:

| DB value | Display label |
|----------|-------------|
| `regulatory` | Regulatory Compliance |
| `ps1` | PS1 · Assessment & Management of E&S Risks |
| `ps2` | PS2 · Labor & Working Conditions |
| `ps3` | PS3 · Resource Efficiency & Pollution Prevention |
| `ps4` | PS4 · Community Health, Safety & Security |
| `ps6` | PS6 · Biodiversity Conservation |
| `ps8` | PS8 · Cultural Heritage |
| `c1` | C1 · Community Engagement |

---

## Coding Conventions

### TypeScript
- `"strict": true` in tsconfig — no exceptions
- No `any`. Use `unknown` + type narrowing if uncertain.
- Explicit return types on all functions

### API Routes (every single one)
```
1. Parse + validate input with Zod
2. Get current user (Clerk session)
3. Check permission with can()
4. Verify resource access (user's workspace is on this project)
5. Execute DB operation (Drizzle, always filter by workspace)
6. Write to activity_log
7. Send email if needed (in try/catch — email failure must not fail the operation)
8. Return { data, error } response
```

### Components
- Named exports (except page.tsx → default export)
- Props typed above component
- One component per file
- Server Component by default, `"use client"` only when interaction needed

### Database
- Never raw SQL. Drizzle only.
- Always filter by workspace_id
- Always filter `WHERE deleted_at IS NULL` for soft-deleted tables
- Never hard-delete anything

### Naming
- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Functions/variables: `camelCase`
- DB tables: `snake_case`
- The word "Action" (capital A) for ESDD actions — never "task", "item", or "action item"

---

## MVP Build Checklist

### Phase 1 (Core Loop — build in this order)

- [ ] **Project setup** — Next.js 14, TypeScript strict, Tailwind, shadcn/ui init
- [ ] **DB schema** — Drizzle schema.ts, push to Neon dev branch
- [ ] **Clerk integration** — middleware, login page, webhook to sync users
- [ ] **Seed script** — all 6 personas, 3 workspaces, Project Yamuna, 22 actions
- [ ] **Admin panel** — `/admin`, ADMIN_SECRET auth, create workspace + send invite
- [ ] **Invite flow** — accept invite page, create account, join workspace
- [ ] **Workspace switcher** — sidebar dropdown for multi-workspace users
- [ ] **Dashboard** — per-persona landing page with project list
- [ ] **Project creation** — Consultant Admin only, creates loanee workspace + sends invite
- [ ] **Action plan editor** — create/edit actions with deliverables, save as draft
- [ ] **Publish action plan** — notification to loanee admin
- [ ] **Loanee action view** — see published actions, assign to team members
- [ ] **File upload** — direct to R2, progress bar, version tracking
- [ ] **Review workflow** — approve / send back with comment
- [ ] **Comments** — post, edit, delete on actions
- [ ] **Email notifications** — all 7 templates via Resend
- [ ] **Activity log** — all key events written + displayed
- [ ] **Empty states** — all list views
- [ ] **Deploy to Vercel** — production URL, env vars set

### Phase 2 (v1.1 — after Phase 1 is solid)
- [ ] Board / Table / Timeline views
- [ ] Manual status change (board drag)
- [ ] @mention in comments + notifications
- [ ] In-app notification bell
- [ ] Document version history UI
- [ ] Pinned projects in sidebar
- [ ] Directory management (consultant/loanee lists)
- [ ] Settings: workspace branding

---

## First Session Commands

```bash
# 1. Install dependencies
npm install

# 2. Copy env template
cp .env.example .env.local
# Fill in .env.local with real values from Neon, Clerk, R2, Resend dashboards

# 3. Push schema to database
npx drizzle-kit push

# 4. Seed demo data
npx tsx lib/db/seed.ts

# 5. Start dev server
npm run dev
# → http://localhost:3000
# → http://localhost:3000/admin (admin panel)
```

Log in as `arjun@hdfccapital.com` / `Test1234!` to start as Bank Admin.
Log in as `priya@ramboll.com` / `Test1234!` to start as Consultant Admin.
Log in as `meera@eldeco.com` / `Test1234!` to start as Loanee Admin.

---

## What's Deferred (Do Not Build in Phase 1)

- Board / Table / Timeline views (v1.1)
- @mention notifications (v1.1)
- In-app notification bell (v1.1)
- Document version history UI (v1.1)
- Pinned projects (v1.1)
- Directory management UI (v1.1)
- Documents tab (removed from scope)
- ESDD report PDF (v2)
- Billing (v2)
- Mobile responsive (v2)

If Claude Code suggests building any of these during Phase 1, stop it.

---

*CLAUDE.md v1.1 — Keep this file updated as the project evolves.*
