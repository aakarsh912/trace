# Trace — Technical Specification
**Version:** 1.1  
**Status:** Approved for Build  
**Last Updated:** May 2026  
**Changelog:** v1.0 → v1.1 — Clerk auth clarified (user auth only, not Organizations), admin panel added, workspace creation flow updated, loanee workspace creation on project creation, action status simplified, documents tab removed, comments added to MVP, sessions set to 7 days, action number sequencing confirmed.

> **How to read this document:** Every major decision includes a "Why this?" rationale. If Claude Code or a developer suggests deviating, the rationale explains the tradeoff.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Design](#4-database-design)
5. [Authentication & Authorisation](#5-authentication--authorisation)
6. [API Design](#6-api-design)
7. [File Storage](#7-file-storage)
8. [Email & Notifications](#8-email--notifications)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Hosting & Deployment](#10-hosting--deployment)
11. [Environments](#11-environments)
12. [Security](#12-security)
13. [Third-Party Services Summary](#13-third-party-services-summary)
14. [Cost Breakdown](#14-cost-breakdown)
15. [Development Conventions](#15-development-conventions)

---

## 1. Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│              (Next.js React App — SSR + CSR)             │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    Vercel Edge                           │
│         (Next.js App Router — server components,        │
│          API routes, middleware)                         │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────────────────────┐
│  Clerk (Auth)    │   │     Neon (PostgreSQL)             │
│  - User identity │   │     - All application data       │
│  - Sessions      │   │     - Workspaces, projects,      │
│  - Passwords     │   │       actions, documents, etc.   │
│  - Password reset│   └──────────────────────────────────┘
└──────────────────┘
                                  
┌──────────────────┐   ┌──────────────────────────────────┐
│  Cloudflare R2   │   │     Resend                       │
│  - File storage  │   │     - Transactional emails       │
│  - Signed URLs   │   │     - Invite links               │
└──────────────────┘   └──────────────────────────────────┘
```

### 1.2 Clerk's Role — Important Clarification

**Clerk handles authentication only.** This means:
- ✅ Verifying email + password
- ✅ Secure session cookies (7-day expiry)
- ✅ Password reset flows
- ✅ Brute force rate limiting
- ✅ Syncing user identity to our DB via webhook

**Clerk does NOT handle:**
- ❌ Workspace membership (our DB handles this)
- ❌ Roles and permissions (our code handles this)
- ❌ Which projects a user can see (our DB handles this)

**Why not use Clerk Organizations?**
Clerk's built-in "Organizations" feature is limited to 5 on the free tier. We have potentially unlimited workspaces (each bank, consultant, and loanee is a workspace). We also need a custom `type` field (`bank`/`consultant`/`loanee`) that Clerk doesn't support. Managing workspaces in our own DB gives us full control with no service limits.

Clerk is still the right choice for authentication — we're just keeping it in its lane.

### 1.3 Request Flow (example: Loanee uploads a document)

```
1. Loanee clicks "Upload" in browser
2. Browser → POST /api/deliverables/:id/upload-url
3. Server: validates Clerk session → confirms user is a Loanee member on this project
4. Server: generates R2 pre-signed PUT URL (valid 5 minutes) → returns to browser
5. Browser uploads file directly to R2 with progress tracking
6. Browser → POST /api/deliverables/:id/submit { fileKey, fileName, fileSize, mimeType }
7. Server: saves document record to Postgres, marks old version is_current = false
8. Server: triggers Resend email to assigned Consultant
9. Browser: shows success state, updates deliverable status chip
```

**Why direct-to-R2?** Routing files through the server wastes bandwidth and slows uploads. The server only handles metadata, not the file bytes.

---

## 2. Tech Stack

### 2.1 Decisions Table

| Layer | Choice | Why this? | Alternative considered |
|-------|--------|-----------|----------------------|
| **Framework** | Next.js 14 (App Router) | Full-stack in one repo, React-based, excellent Claude Code support, Vercel-native | Remix, SvelteKit |
| **Language** | TypeScript (strict) | Catches bugs before runtime, Claude Code generates better TS, industry standard | JavaScript |
| **Styling** | Tailwind CSS | Fast to write, pairs with shadcn/ui, Claude Code generates excellent Tailwind | CSS Modules |
| **Component library** | shadcn/ui | Free, customisable (not opinionated), TypeScript-native, copy-paste model | Chakra, MUI |
| **Database** | PostgreSQL via Neon | Relational = correct for this structured multi-tenant data model. Neon is serverless, free tier generous, supports DB branching | MongoDB, Supabase |
| **ORM** | Drizzle ORM | Lightweight, TypeScript-native, readable SQL output, easier to debug than Prisma | Prisma, raw SQL |
| **Auth** | Clerk (user identity only) | Never build auth yourself. Handles passwords, sessions, resets securely. Free to 10K MAU | Auth.js, WorkOS |
| **File storage** | Cloudflare R2 | No egress fees — critical for document-heavy app. S3-compatible. Free to 10GB | AWS S3 |
| **Email** | Resend + React Email | Simple API, free tier (3K/month), React templates, great deliverability | SendGrid, Postmark |
| **Hosting** | Vercel | Zero-config deploys, preview URLs per branch, global CDN, GitHub integration | Railway, Fly.io |
| **Server state** | TanStack Query | Caching, loading states, background refetch — essential for live dashboard feel | SWR |
| **UI state** | Zustand | Simple, minimal boilerplate, only for modals/tabs/selections | Redux |
| **Validation** | Zod | Runtime type safety, TypeScript integration, pairs with React Hook Form | Yup |
| **Forms** | React Hook Form + Zod | Performant, minimal re-renders, Zod integration for validation | Formik |

### 2.2 Stack Guardrails for Claude Code

Enforce these during every build session. Do not deviate.

- **Don't** add a separate Express/FastAPI backend. Everything lives in Next.js API routes.
- **Don't** use Firebase or Supabase as the database. We use Neon/Postgres.
- **Don't** use Clerk Organizations. Workspaces are in our own DB.
- **Don't** switch ORM mid-project. Drizzle everywhere.
- **Don't** use `any` in TypeScript. Strict mode means strict mode.
- **Don't** do raw SQL with user input. Drizzle parameterises everything.

---

## 3. Repository Structure

```
trace/
├── app/
│   ├── (auth)/                     # Public auth routes
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── invite/[token]/
│   │   │   └── page.tsx            # Accept invite + create account
│   │   └── reset-password/
│   │       └── page.tsx
│   ├── (dashboard)/                # Protected — requires auth + workspace
│   │   ├── layout.tsx              # Sidebar + topbar
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Per-persona dashboard
│   │   ├── projects/
│   │   │   ├── page.tsx            # Projects list
│   │   │   ├── new/
│   │   │   │   └── page.tsx        # Create project (Consultant only)
│   │   │   └── [projectId]/
│   │   │       ├── page.tsx        # Project overview + Actions list
│   │   │       └── actions/
│   │   │           └── [actionId]/
│   │   │               └── page.tsx # Action detail
│   │   └── settings/
│   │       ├── general/
│   │       └── members/
│   └── admin/                      # Platform operator panel
│       ├── layout.tsx              # Admin auth check
│       └── page.tsx                # Workspace list + create workspace
│
├── api/                            # Next.js API routes
│   ├── webhooks/
│   │   └── clerk/                  # Sync user to DB on create/update
│   ├── workspaces/
│   │   ├── route.ts                # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts            # GET, PATCH
│   │       └── invite/
│   │           └── route.ts        # POST — send invite
│   ├── invites/
│   │   └── [token]/
│   │       └── accept/
│   │           └── route.ts        # POST — accept invite
│   ├── projects/
│   │   ├── route.ts                # GET, POST
│   │   └── [id]/
│   │       ├── route.ts            # GET, PATCH
│   │       └── actions/
│   │           └── route.ts        # GET, POST
│   ├── actions/
│   │   └── [id]/
│   │       ├── route.ts            # GET, PATCH, DELETE
│   │       ├── publish/
│   │       │   └── route.ts        # POST — publish action plan
│   │       └── approve/
│   │           └── route.ts        # POST — approve action
│   ├── deliverables/
│   │   └── [id]/
│   │       ├── upload-url/
│   │       │   └── route.ts        # POST — get R2 signed upload URL
│   │       ├── submit/
│   │       │   └── route.ts        # POST — mark submitted after upload
│   │       └── review/
│   │           └── route.ts        # POST — approve or send back
│   └── comments/
│       ├── route.ts                # POST — create comment
│       └── [id]/
│           └── route.ts            # PATCH, DELETE
│
├── components/
│   ├── ui/                         # shadcn/ui (auto-generated, don't edit)
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   └── workspace-switcher.tsx
│   ├── projects/
│   │   ├── project-card.tsx
│   │   └── create-project-form.tsx
│   ├── actions/
│   │   ├── action-card.tsx
│   │   ├── action-detail.tsx
│   │   └── action-modal.tsx
│   ├── deliverables/
│   │   ├── deliverable-row.tsx
│   │   ├── upload-zone.tsx
│   │   └── review-controls.tsx
│   ├── comments/
│   │   ├── comment-thread.tsx
│   │   └── comment-composer.tsx
│   └── shared/
│       ├── status-chip.tsx
│       ├── empty-state.tsx
│       └── activity-log.tsx
│
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Single source of truth for DB shape
│   │   ├── client.ts               # Drizzle + Neon client
│   │   ├── seed.ts                 # Dev/demo seed data
│   │   └── migrations/             # Auto-generated by Drizzle
│   ├── auth/
│   │   ├── clerk.ts                # Clerk helpers (getCurrentUser etc.)
│   │   └── permissions.ts          # Role-based permission checks
│   ├── email/
│   │   ├── client.ts               # Resend client
│   │   └── templates/
│   │       ├── workspace-invite.tsx
│   │       ├── action-plan-published.tsx
│   │       ├── deliverable-submitted.tsx
│   │       ├── deliverable-approved.tsx
│   │       ├── deliverable-sent-back.tsx
│   │       ├── action-approved.tsx
│   │       └── action-assigned.tsx
│   ├── storage/
│   │   └── r2.ts                   # R2 client, signed URL generation
│   └── validators/
│       ├── project.ts              # Zod schemas for project endpoints
│       ├── action.ts
│       ├── deliverable.ts
│       └── comment.ts
│
├── hooks/
│   ├── use-current-workspace.ts
│   └── use-permissions.ts
│
├── types/
│   └── index.ts                    # Shared TypeScript types
│
├── middleware.ts                   # Clerk auth — protects /dashboard routes
├── prototype/
│   └── trace.html                  # Visual + interaction reference
├── docs/
│   ├── PRD.md
│   └── TECH_SPEC.md
├── CLAUDE.md
├── .env.example
├── .env.local                      # Never committed
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 4. Database Design

### 4.1 Design Principles

- **Workspace isolation:** Every table with workspace-scoped data has a `workspace_id`. This is the primary data isolation mechanism.
- **Soft deletes:** Nothing is hard-deleted. `deleted_at` timestamp preserves audit trail.
- **Timestamps everywhere:** `created_at` and `updated_at` on every table.
- **UUIDs as primary keys:** Safe to expose in URLs, don't leak counts, no sequence conflicts.
- **Computed statuses:** Action and Project statuses are derived from child records, not manually set (MVP). This prevents impossible states.

### 4.2 Schema

```sql
-- ════════════════════════════════════════
-- WORKSPACES & USERS
-- ════════════════════════════════════════

CREATE TYPE workspace_type AS ENUM ('bank', 'consultant', 'loanee');
CREATE TYPE user_role AS ENUM ('admin', 'member');

CREATE TABLE workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,      -- e.g. "hdfc-capital", "ramboll-mumbai"
  type        workspace_type NOT NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

-- Users synced from Clerk via webhook on user.created / user.updated
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  job_title     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- One user can belong to multiple workspaces with different roles
CREATE TABLE workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  role         user_role NOT NULL DEFAULT 'member',
  invited_by   UUID REFERENCES users(id),
  joined_at    TIMESTAMPTZ,             -- null = invite pending
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Pending invitations (for all workspace types)
CREATE TABLE invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id),
  email         TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'member',
  token         TEXT UNIQUE NOT NULL,   -- in email link, never guessable
  invited_by    UUID REFERENCES users(id), -- null = platform operator via admin panel
  expires_at    TIMESTAMPTZ NOT NULL,   -- 7 days from creation
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════
-- WORKSPACE RELATIONSHIPS
-- ════════════════════════════════════════

-- Tracks which consultants a bank has in their network (directory)
CREATE TABLE bank_consultant_relationships (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_workspace_id       UUID NOT NULL REFERENCES workspaces(id),
  consultant_workspace_id UUID NOT NULL REFERENCES workspaces(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_workspace_id, consultant_workspace_id)
);

-- ════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════

-- Note: project status is computed from actions, not stored directly
-- The status shown in UI is derived at query time

CREATE TABLE projects (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  description             TEXT,
  bank_workspace_id       UUID NOT NULL REFERENCES workspaces(id),
  consultant_workspace_id UUID NOT NULL REFERENCES workspaces(id),
  loanee_workspace_id     UUID NOT NULL REFERENCES workspaces(id),
  ifc_project_category    TEXT,         -- e.g. "Category B"
  location_state          TEXT,
  location_city           TEXT,
  construction_start_date DATE,         -- informational only in MVP
  is_published            BOOLEAN DEFAULT FALSE, -- false = action plan not yet published
  created_by              UUID NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ
);

-- Which individual users are on a project
-- All workspace members of the 3 associated workspaces get implicit access
-- This table handles explicitly-added project members (future feature)
CREATE TABLE project_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id),
  user_id      UUID NOT NULL REFERENCES users(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  added_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- ════════════════════════════════════════
-- ACTIONS & DELIVERABLES
-- ════════════════════════════════════════

CREATE TYPE ifc_category AS ENUM (
  'regulatory', 'ps1', 'ps2', 'ps3', 'ps4', 'ps6', 'ps8', 'c1'
);

CREATE TYPE action_priority AS ENUM ('critical', 'high', 'medium', 'low');

-- Note: action status is NOT stored — it is computed from deliverable statuses
-- Computed status logic (applied in application layer):
--   all deliverables not_started/in_progress → 'in_progress'
--   any deliverable sent_back → 'requires_attention'
--   all deliverables approved → 'completed'
--   action plan not published → 'draft'

CREATE TABLE actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  action_number   TEXT NOT NULL,        -- e.g. "PS2-1", "PS2-2", "RC-1"
  ifc_category    ifc_category NOT NULL,
  topic           TEXT NOT NULL,        -- short title
  recommendation  TEXT NOT NULL,        -- full text
  department_hint TEXT,                 -- informational: suggested loanee team
  reference_link  TEXT,
  priority        action_priority,
  target_date     DATE,
  assigned_to     UUID REFERENCES users(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(project_id, action_number)
);

-- Tracks the highest sequence number used per category per project
-- Used to generate action_number without gaps or races
CREATE TABLE action_number_sequences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id),
  ifc_category ifc_category NOT NULL,
  last_number  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project_id, ifc_category)
);

CREATE TYPE deliverable_status AS ENUM (
  'not_started',
  'submitted',
  'approved',
  'sent_back',
  'resubmitted'
);

CREATE TABLE deliverables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id    UUID NOT NULL REFERENCES actions(id),
  letter       CHAR(1) NOT NULL,        -- 'a', 'b', 'c'...
  description  TEXT NOT NULL,
  status       deliverable_status NOT NULL DEFAULT 'not_started',
  assigned_to  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(action_id, letter)
);

-- Optional: specific document types the loanee should provide for a deliverable
CREATE TABLE deliverable_required_docs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id  UUID NOT NULL REFERENCES deliverables(id),
  doc_description TEXT NOT NULL,        -- e.g. "HR Policy document (PDF)"
  sort_order      INTEGER DEFAULT 0
);

-- ════════════════════════════════════════
-- DOCUMENTS (FILE UPLOADS)
-- ════════════════════════════════════════

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id  UUID NOT NULL REFERENCES deliverables(id),
  project_id      UUID NOT NULL REFERENCES projects(id),   -- denormalised for fast queries
  workspace_id    UUID NOT NULL REFERENCES workspaces(id), -- uploader's workspace
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  file_name       TEXT NOT NULL,          -- original filename shown to user
  file_key        TEXT NOT NULL UNIQUE,   -- R2 object key (path in bucket)
  file_size_bytes INTEGER NOT NULL,
  mime_type       TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  is_current      BOOLEAN NOT NULL DEFAULT TRUE, -- only one TRUE per deliverable
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index to find current document for a deliverable quickly
CREATE INDEX idx_documents_deliverable_current
  ON documents(deliverable_id, is_current)
  WHERE is_current = TRUE;

-- ════════════════════════════════════════
-- REVIEWS
-- ════════════════════════════════════════

CREATE TYPE review_decision AS ENUM ('approved', 'sent_back');

CREATE TABLE reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES deliverables(id),
  document_id    UUID NOT NULL REFERENCES documents(id),
  reviewer_id    UUID NOT NULL REFERENCES users(id),
  decision       review_decision NOT NULL,
  comment        TEXT,                  -- required if decision = 'sent_back'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════
-- COMMENTS
-- ════════════════════════════════════════

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id  UUID NOT NULL REFERENCES actions(id),
  author_id  UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  edited_at  TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ               -- soft delete; shown as "Comment deleted"
);

-- ════════════════════════════════════════
-- ACTIVITY LOG
-- ════════════════════════════════════════

CREATE TABLE activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id),
  actor_id     UUID NOT NULL REFERENCES users(id),
  event_type   TEXT NOT NULL,
  -- Event types used:
  -- 'project.created', 'project.published'
  -- 'action.created', 'action.edited', 'action.approved'
  -- 'deliverable.submitted', 'deliverable.approved', 'deliverable.sent_back'
  -- 'document.uploaded'
  -- 'comment.created', 'comment.edited', 'comment.deleted'
  -- 'member.joined'
  entity_type  TEXT NOT NULL,           -- 'project', 'action', 'deliverable', 'comment'
  entity_id    UUID NOT NULL,
  metadata     JSONB,                   -- flexible: e.g. { actionNumber: "PS2-1", comment: "..." }
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_project
  ON activity_log(project_id, created_at DESC);
```

### 4.3 Key Design Decisions

**Why is action status computed and not stored?**
Storing status in the DB creates the risk of it getting out of sync with deliverable statuses. Computing it from child records means it's always accurate. The trade-off is a slightly more complex query — acceptable for this scale.

**Why `action_number_sequences` table?**
Generating `PS2-1, PS2-2` etc. safely in a concurrent environment requires tracking the last used number. We can't just `SELECT MAX(action_number)` because two requests could race. A dedicated sequences table with a `UPDATE ... RETURNING` pattern prevents duplicates.

**Why `is_current` on documents instead of just querying `MAX(version)`?**
`is_current` lets us add an index and avoids aggregation queries. When a re-upload happens, we set all existing documents for that deliverable to `is_current = FALSE` and insert the new one as `TRUE`. Fast and clear.

**Why soft deletes everywhere?**
Compliance platforms need audit trails. Hard-deleting records destroys evidence. `deleted_at` lets us keep the record, exclude it from normal queries (`WHERE deleted_at IS NULL`), and show it in audit views.

---

## 5. Authentication & Authorisation

### 5.1 Clerk — What It Handles

| Concern | Clerk handles it |
|---------|-----------------|
| Email + password login | ✅ Yes |
| Secure session cookies | ✅ Yes (7-day expiry, HTTP-only) |
| Password reset via email | ✅ Yes |
| Brute force rate limiting | ✅ Yes |
| User created/updated webhook | ✅ Yes → we sync to `users` table |
| Workspace membership | ❌ No → our `workspace_members` table |
| Roles and permissions | ❌ No → our `permissions.ts` |
| Which projects user can see | ❌ No → our DB queries |

### 5.2 Session Flow

```
User submits login form
      ↓
Clerk verifies email + password
      ↓
Clerk sets secure HTTP-only session cookie (7 days)
      ↓
User lands on /dashboard
      ↓
Middleware (middleware.ts) reads Clerk session → gets clerk_user_id
      ↓
We query: SELECT * FROM users WHERE clerk_user_id = ?
      ↓
We query: SELECT * FROM workspace_members WHERE user_id = ? AND joined_at IS NOT NULL
      ↓
If user has one workspace → load it
If user has multiple → show workspace switcher
If user has none → show "waiting for invite" screen
```

### 5.3 Workspace Switcher

When a user belongs to multiple workspaces (common for consultants who work with multiple banks):
- A workspace switcher appears in the sidebar
- Switching sets a `current_workspace_id` in a server-side cookie
- All subsequent requests use that workspace context
- No re-login required

### 5.4 Admin Panel Authentication

The `/admin` route is protected differently from the main app:
- No Clerk — uses a simple secret comparison
- Middleware checks: `request.headers.get('x-admin-key') === process.env.ADMIN_SECRET`
- In practice: the admin panel has a password field. On submit, it sets a cookie with the hashed secret. All subsequent admin requests check that cookie.
- This is intentionally simple — the admin panel is for one person (you).

### 5.5 Authorisation — Permissions

```typescript
// lib/auth/permissions.ts

export type Permission =
  | 'project:create'
  | 'project:read'
  | 'action:create'
  | 'action:edit'
  | 'action:publish'
  | 'action:approve'
  | 'deliverable:submit'
  | 'deliverable:review'
  | 'comment:create'
  | 'workspace:invite'
  | 'workspace:manage_members';

const PERMISSIONS: Record<string, Record<string, Permission[]>> = {
  bank: {
    admin: [
      'project:read',
      'comment:create',
      'workspace:invite',
      'workspace:manage_members',
    ],
    member: [
      'project:read',
      'comment:create',
    ],
  },
  consultant: {
    admin: [
      'project:create',
      'project:read',
      'action:create',
      'action:edit',
      'action:publish',
      'action:approve',
      'deliverable:review',
      'comment:create',
      'workspace:invite',
      'workspace:manage_members',
    ],
    member: [
      'project:read',
      'action:create',
      'action:edit',
      'deliverable:review',
      'comment:create',
    ],
  },
  loanee: {
    admin: [
      'project:read',
      'deliverable:submit',
      'comment:create',
      'workspace:invite',
      'workspace:manage_members',
    ],
    member: [
      'project:read',
      'deliverable:submit',
      'comment:create',
    ],
  },
};

export function can(
  workspaceType: string,
  role: string,
  permission: Permission
): boolean {
  return PERMISSIONS[workspaceType]?.[role]?.includes(permission) ?? false;
}
```

**Every API route must call `can()` before performing any data operation.** No exceptions.

---

## 6. API Design

### 6.1 Approach

All server logic lives in **Next.js Route Handlers** (`app/api/...`). No separate backend.

### 6.2 Full API Route List

```
# Auth / Workspaces
POST   /api/workspaces                        Create workspace (admin panel only)
GET    /api/workspaces/mine                   List workspaces for current user
POST   /api/workspaces/:id/invite             Send invite email
POST   /api/invites/:token/accept             Accept invite, create user if needed

# Projects
GET    /api/projects                          List projects for current workspace
POST   /api/projects                          Create project (Consultant Admin only)
GET    /api/projects/:id                      Get project with actions summary
PATCH  /api/projects/:id                      Update project fields

# Actions
GET    /api/projects/:id/actions              List all actions in a project
POST   /api/projects/:id/actions              Create a new action
GET    /api/actions/:id                       Get action with deliverables + comments
PATCH  /api/actions/:id                       Edit action fields (logged)
DELETE /api/actions/:id                       Soft-delete action (Consultant only)
POST   /api/actions/:id/publish               Publish action plan (Consultant Admin only)
POST   /api/actions/:id/approve               Approve action (all deliverables must be approved)

# Deliverables
PATCH  /api/deliverables/:id                  Update deliverable (assign, edit description)
POST   /api/deliverables/:id/upload-url       Get R2 pre-signed URL for upload
POST   /api/deliverables/:id/submit           Mark as submitted after upload completes
POST   /api/deliverables/:id/review           Approve or send back (Consultant only)

# Comments
GET    /api/actions/:id/comments              List comments for an action
POST   /api/actions/:id/comments              Create comment
PATCH  /api/comments/:id                      Edit comment (author only)
DELETE /api/comments/:id                      Soft-delete comment (author only)

# Activity Log
GET    /api/projects/:id/activity             Get activity log for a project

# Webhooks
POST   /api/webhooks/clerk                    Sync Clerk user events to our DB
```

### 6.3 Standard Response Format

```typescript
// Every API route returns this shape
type ApiResponse<T> = 
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }
```

### 6.4 API Route Template

Every route follows this exact pattern — no exceptions:

```typescript
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/clerk';
import { can } from '@/lib/auth/permissions';
import { db } from '@/lib/db/client';

const CreateActionSchema = z.object({
  topic: z.string().min(1).max(200),
  recommendation: z.string().min(1),
  ifcCategory: z.enum(['regulatory', 'ps1', 'ps2', 'ps3', 'ps4', 'ps6', 'ps8', 'c1']),
  targetDate: z.string().datetime().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1. Validate input
  const body = await req.json();
  const parsed = CreateActionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: { code: 'VALIDATION_ERROR', message: parsed.error.message } },
      { status: 400 }
    );
  }

  // 2. Authenticate
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { data: null, error: { code: 'UNAUTHORISED', message: 'Not logged in' } },
      { status: 401 }
    );
  }

  // 3. Authorise
  if (!can(user.workspaceType, user.role, 'action:create')) {
    return Response.json(
      { data: null, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  // 4. Verify project access (user's workspace is the consultant on this project)
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, params.id),
      eq(projects.consultantWorkspaceId, user.workspaceId),
      isNull(projects.deletedAt)
    )
  });
  if (!project) {
    return Response.json(
      { data: null, error: { code: 'NOT_FOUND', message: 'Project not found' } },
      { status: 404 }
    );
  }

  // 5. Execute
  const action = await db.insert(actions).values({ ... }).returning();

  // 6. Log to activity
  await db.insert(activityLog).values({ ... });

  // 7. Return
  return Response.json({ data: action[0], error: null }, { status: 201 });
}
```

---

## 7. File Storage

### 7.1 Cloudflare R2 Buckets

| Bucket | Purpose | Access |
|--------|---------|--------|
| `trace-documents` | User-uploaded evidence files | Private, signed URLs only |
| `trace-assets` | Workspace logos, avatars (v1.1) | Private, signed URLs only |

### 7.2 File Key Structure

```
documents/{projectId}/{actionId}/{deliverableId}/{timestamp}-{sanitisedFilename}

Example:
documents/abc123/def456/ghi789/1716825600000-attendance-records.pdf
```

No personally identifiable information in the key. Timestamp prevents collisions.

### 7.3 Upload Flow (detailed)

```typescript
// Step 1: Get signed URL
POST /api/deliverables/:id/upload-url
Body: { fileName: string, fileSize: number, mimeType: string }

// Server validates:
// - User is Loanee member on this project
// - fileSize <= 25MB
// - mimeType in allowed list
// - Deliverable status allows upload (not already approved)

// Returns: { uploadUrl: string, fileKey: string }

// Step 2: Browser uploads directly to R2
PUT {uploadUrl}  ← this is a pre-signed R2 URL
Body: [file bytes]
Headers: Content-Type: {mimeType}

// Step 3: Confirm upload
POST /api/deliverables/:id/submit
Body: { fileKey: string, fileName: string, fileSize: number }

// Server:
// - Sets all existing docs for this deliverable is_current = false
// - Inserts new document record (version = previous_max + 1)
// - Updates deliverable status to 'submitted'
// - Triggers email notification to consultant
// - Writes to activity log
```

### 7.4 Download Flow

```typescript
// User clicks download
GET /api/documents/:id/download

// Server:
// - Verifies user has project access
// - Generates R2 signed GET URL (15-minute expiry)
// - Returns { url: string }

// Browser redirects to signed URL → file downloads
```

---

## 8. Email & Notifications

### 8.1 Templates Required (MVP)

All templates built with React Email. Each is a `.tsx` file in `lib/email/templates/`.

| Template file | Subject line |
|---------------|-------------|
| `workspace-invite.tsx` | "You've been invited to join {workspaceName} on Trace" |
| `action-plan-published.tsx` | "Action plan ready — {count} actions to complete on {projectName}" |
| `deliverable-submitted.tsx` | "{submitterName} submitted {actionNumber}({letter}) on {projectName}" |
| `deliverable-approved.tsx` | "✓ {actionNumber}({letter}) approved on {projectName}" |
| `deliverable-sent-back.tsx` | "{actionNumber}({letter}) needs revision — {projectName}" |
| `action-approved.tsx` | "✓ Action {actionNumber} completed on {projectName}" |
| `action-assigned.tsx` | "You've been assigned {actionNumber} on {projectName}" |

### 8.2 Email Structure (all templates)

```
From: Trace <notifications@yourdomain.com>
      (or onboarding@resend.dev during development — update when domain exists)

[Trace wordmark — text only for now, logo in v1.1]
[Greeting: "Hi {firstName},"]
[One-sentence summary of what happened]
[Context block: project name, action number, any relevant comment]
[CTA button: "View in Trace" → deep link to exact page]
[Footer: "You're receiving this because you're a member of {workspaceName} on Trace"]
```

### 8.3 Sending Emails

```typescript
// lib/email/client.ts
import { Resend } from 'resend';
export const resend = new Resend(process.env.RESEND_API_KEY);

// Usage in API route (after the main operation succeeds)
await resend.emails.send({
  from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
  to: recipientEmail,
  subject: emailSubject,
  react: <DeliverableSubmittedEmail {...props} />,
});
```

Emails are sent synchronously in MVP. If sending fails, it should not fail the main operation — wrap in try/catch and log the error.

---

## 9. Frontend Architecture

### 9.1 Rendering Strategy

| Content type | Rendering | Reason |
|-------------|-----------|--------|
| Project list, action list | Server Component | No interactivity, just data display |
| Dashboard metrics | Server Component + revalidation | Fetched fresh on each visit |
| Upload zone | Client Component | File picker, progress bar, state |
| Comment composer | Client Component | Typing, submit, optimistic update |
| Modals, drawers | Client Component | Open/close state |
| Workspace switcher | Client Component | Dropdown interaction |

### 9.2 Design System

The prototype (`prototype/trace.html`) is the definitive visual reference. Implement with:
- Tailwind utility classes for layout, spacing, typography
- CSS custom properties for colour tokens (allows easy theming later)
- shadcn/ui for: Dialog, DropdownMenu, Tooltip, Select, Badge, Button, Input, Textarea, Avatar

**Colour tokens (from prototype — carry into `globals.css`):**
```css
:root {
  --bg: #FFFFFF;
  --fg: #111111;
  --fg-secondary: #555555;
  --fg-tertiary: #999999;
  --border: #E5E5E5;
  --bg-subtle: #F8F8F8;

  /* Status colours */
  --status-approved-fg: #1E4B3B;
  --status-approved-bg: #EBF5EF;
  --status-returned-fg: #9B7400;
  --status-returned-bg: #FEF3C7;
  --status-submitted-fg: #2B5C8A;
  --status-submitted-bg: #EBF2FE;
  --status-draft-fg: #6B7280;
  --status-draft-bg: #F3F4F6;
  --status-attention-fg: #9B3A3A;
  --status-attention-bg: #FEF2F2;

  /* Workspace accent colours */
  --accent-bank: #2B3F6A;
  --accent-consultant: #3F3F3F;
  --accent-loanee: #1E4B3B;

  --radius: 6px;
  --radius-lg: 10px;
}
```

### 9.3 Empty States

Every list view must render an empty state when there is no data. Use the `EmptyState` component:

```typescript
// components/shared/empty-state.tsx
type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
};
```

Reference the prototype's `view-empty-*` screens for the exact copy and icon for each empty state.

### 9.4 Loading States

Every data-fetching component shows a skeleton loader while loading. Use shadcn/ui `Skeleton` component. Never show a blank white screen.

---

## 10. Hosting & Deployment

### 10.1 Vercel Setup

1. Connect GitHub repo to Vercel
2. Set all environment variables in Vercel dashboard (Settings → Environment Variables)
3. Every push to `main` → auto-deploys to production
4. Every push to any other branch → auto-creates a preview URL

### 10.2 Deployment Flow

```
You write code locally
      │ git push origin feature/action-plan-editor
      ▼
GitHub receives the push
      │ Vercel webhook fires
      ▼
Vercel builds and deploys
      │
      ▼
Preview URL: https://trace-git-feature-action-plan.vercel.app
      │ You test it, looks good
      ▼
Merge to main on GitHub
      │ Vercel webhook fires again
      ▼
Production: https://your-vercel-url.vercel.app (or custom domain later)
```

### 10.3 Environment Variables

```bash
# .env.example — commit this file (no real values)
# .env.local — never commit this (your actual values)

# Database
DATABASE_URL=                           # Neon connection string

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=      # Safe to expose to browser
CLERK_SECRET_KEY=                       # Server-only, never expose
CLERK_WEBHOOK_SECRET=                   # Verifies webhook is from Clerk

# File Storage (Cloudflare R2)
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=trace-documents
CLOUDFLARE_R2_PUBLIC_URL=              # Your R2 bucket's public URL

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=onboarding@resend.dev       # Update to notifications@yourdomain.com when ready

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Update per environment

# Admin Panel
ADMIN_SECRET=                          # Long random string — protects /admin
```

---

## 11. Environments

| Environment | URL | Database | When to use |
|-------------|-----|----------|-------------|
| **Local** | `localhost:3000` | Neon dev branch | Daily development |
| **Preview** | `trace-git-[branch].vercel.app` | Neon dev branch | Testing before merging |
| **Production** | `[your-vercel-url].vercel.app` | Neon main branch | Real usage / demos |

### 11.1 Neon Database Branching

Create two Neon branches:
- `main` — production data
- `dev` — development and preview (can be reset freely)

Set `DATABASE_URL` in Vercel:
- Production environment → Neon `main` branch URL
- Preview + Development environments → Neon `dev` branch URL

### 11.2 Seed Script

`lib/db/seed.ts` populates the dev database with demo data:

```
Workspaces:    HDFC Capital (bank), Ramboll Mumbai (consultant), Eldeco Group (loanee)
Users:         All 6 personas with test passwords
Relationships: HDFC ↔ Ramboll consultant relationship
Project:       "Project Yamuna" linking all three workspaces
Actions:       22 seeded actions across all IFC categories
Deliverables:  Multiple deliverables per action
Status:        Mix of approved, in_progress, sent_back states for demo realism
```

Run with: `npx tsx lib/db/seed.ts`

### 11.3 Migration Strategy

```bash
# When you change lib/db/schema.ts:
npx drizzle-kit generate    # creates SQL migration file in lib/db/migrations/
npx drizzle-kit migrate     # applies it to the current DATABASE_URL

# Never edit migration files manually
# Never manually ALTER TABLE in production
# Always go through the migration system
```

---

## 12. Security

### 12.1 Security Checklist

| Risk | Mitigation |
|------|-----------|
| SQL injection | Drizzle ORM — all queries parameterised, no string concatenation |
| XSS | React escapes all output. Never use `dangerouslySetInnerHTML`. |
| CSRF | Clerk session tokens + Next.js headers handle this |
| Unauthorised file access | Signed URLs only, 15-min expiry, server validates user before issuing |
| Cross-workspace data leak | Every query filters by workspace_id. Verified in app layer. |
| Secrets exposed | All in env vars. `.env.local` in `.gitignore`. Never in code. |
| Brute force login | Clerk handles rate limiting |
| Admin panel exposed | Not linked anywhere. URL-only. Protected by ADMIN_SECRET cookie. |
| File type abuse | Server validates MIME type before issuing upload URL |

### 12.2 Data Isolation Pattern

The golden rule: **every query that returns workspace data must filter by the current user's workspace.**

```typescript
// ✅ Correct — always filter by workspace
const projects = await db.query.projects.findMany({
  where: and(
    or(
      eq(projects.bankWorkspaceId, currentWorkspaceId),
      eq(projects.consultantWorkspaceId, currentWorkspaceId),
      eq(projects.loaneeWorkspaceId, currentWorkspaceId),
    ),
    isNull(projects.deletedAt)
  )
});

// ❌ Wrong — never return all records without workspace filter
const projects = await db.query.projects.findMany();
```

---

## 13. Third-Party Services Summary

| Service | Purpose | Free tier | Upgrade trigger |
|---------|---------|-----------|----------------|
| **Vercel** | Hosting + CI/CD + preview URLs | Yes | High traffic / SSO needed |
| **Neon** | PostgreSQL database | Yes (0.5GB) | DB > 0.5GB |
| **Clerk** | User auth (login, sessions, password reset) | Yes (10K MAU) | > 10K monthly active users |
| **Cloudflare R2** | File storage | Yes (10GB) | > 10GB stored |
| **Resend** | Transactional email | Yes (3K/month) | > 3K emails/month ($20/mo) |
| **GitHub** | Code repo + version control | Yes | Never |

---

## 14. Cost Breakdown

### Early stage (< 100 users)

| Service | Monthly cost |
|---------|-------------|
| Vercel | $0 |
| Neon | $0 |
| Clerk | $0 |
| Cloudflare R2 | $0 |
| Resend | $0 |
| Domain (when purchased) | ~$1 |
| **Total** | **~$0–1/month** |

### Growth stage (100–500 users)

| Service | Monthly cost |
|---------|-------------|
| Vercel | $0–20 |
| Neon | $19 (Launch plan) |
| Clerk | $0 |
| Cloudflare R2 | $2–5 |
| Resend | $20 |
| **Total** | **~$40–65/month** |

---

## 15. Development Conventions

### 15.1 TypeScript

- Strict mode always — `"strict": true` in `tsconfig.json`
- No `any` types. If you don't know the type, use `unknown` and narrow it.
- Prefer `type` over `interface` for data shapes
- All async functions must have explicit return types

### 15.2 Components

```typescript
// Named exports only (except page.tsx files which use default export)
// Props type defined above the component
// No inline arrow functions for event handlers in JSX (define them above return)

type ActionCardProps = {
  action: Action;
  onApprove: (id: string) => void;
};

export function ActionCard({ action, onApprove }: ActionCardProps) {
  function handleApprove() {
    onApprove(action.id);
  }
  return <div onClick={handleApprove}>...</div>;
}
```

### 15.3 Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `action-card.tsx`, `permissions.ts` |
| Components | PascalCase | `ActionCard`, `DeliverableRow` |
| Functions / variables | camelCase | `getProjectById`, `currentWorkspace` |
| DB tables | snake_case | `workspace_members`, `activity_log` |
| API routes | kebab-case | `/api/action-plan/publish` |
| Env vars | SCREAMING_SNAKE_CASE | `CLERK_SECRET_KEY` |
| Domain terms | Exact casing: "Action", "Deliverable", "Workspace" |

### 15.4 Git Branches

```
main                 → production (never commit directly)
feature/[name]       → new features (e.g. feature/action-plan-editor)
fix/[name]           → bug fixes (e.g. fix/deliverable-status-update)
```

Merge via pull request. Keep branches short-lived. One feature per branch.

### 15.5 Error Handling

- API routes always return `{ data, error }` — never throw unhandled errors to the client
- Client-side errors show a toast notification (never a broken UI)
- Email failures are logged but never fail the main operation
- File upload failures show inline error with retry option

---

*End of Technical Specification v1.1 — Approved for Build*
