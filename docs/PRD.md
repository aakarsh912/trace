# Trace — Product Requirements Document
**Version:** 1.1  
**Status:** Approved for Build  
**Author:** Product Design Lead  
**Last Updated:** May 2026  
**Changelog:** v1.0 → v1.1 — resolved all open issues from review, added admin panel, clarified workspace creation flow, comments added to MVP, documents tab removed, empty states formalised.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Problem Statement](#2-problem-statement)
3. [Target Users & Personas](#3-target-users--personas)
4. [User Stories](#4-user-stories)
5. [Feature Requirements](#5-feature-requirements)
6. [User Flows](#6-user-flows)
7. [Business Rules](#7-business-rules)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Out of Scope for MVP](#9-out-of-scope-for-mvp)
10. [Success Metrics](#10-success-metrics)

---

## 1. Product Overview

### 1.1 What is Trace?

Trace is a multi-tenant B2B SaaS platform for Environmental and Social Due Diligence (ESDD) compliance tracking. It digitises the process by which development finance institutions (banks) ensure their real estate and infrastructure borrowers meet IFC Performance Standards — replacing scattered email chains, shared drives, and manual follow-up with a structured, auditable workflow platform.

### 1.2 The ESDD Process Trace Supports

1. A **Bank** approves a loan to a **Loanee** (real estate developer / infrastructure company) subject to ESDD conditions
2. The Bank assigns a **Consultant** firm to conduct the ESDD assessment and author an action plan
3. The Consultant drafts an **Action Plan** — a set of numbered Actions aligned to IFC Performance Standards (PS1–PS8) with measurable deliverables and deadlines
4. The Consultant publishes the Action Plan to the Loanee
5. The **Loanee** works through each Action: uploading evidence documents against each deliverable
6. The Consultant **reviews** each submission — approving or sending back with notes
7. The **Bank** has read-only oversight of the entire process
8. The process concludes when all Actions are approved

### 1.3 Product Vision

> **Trace makes ESDD compliance trackable, auditable, and collaborative — so banks can lend with confidence, consultants can work efficiently, and loanees know exactly what's expected of them.**

### 1.4 Version Scope

| Version | Focus |
|---------|-------|
| **v1 (MVP)** | Core ESDD loop: admin panel → invite → action plan → upload → review → approve. Hosted, real auth, real files, email notifications, comments |
| **v1.1** | Full prototype feature parity: board/table/timeline views, directories, settings, activity logs, @mention comments, document version history, pinned projects, in-app notifications |
| **v2** | ESDD report PDF generation, billing/subscriptions, mobile responsive, advanced analytics |

---

## 2. Problem Statement

### 2.1 Current State

ESDD compliance management today is predominantly manual:
- Consultants send Word documents or Excel trackers to loanees via email
- Loanees upload documents to shared Google Drive or Dropbox folders with inconsistent naming
- Banks track status via periodic emails or calls to consultants
- No single source of truth — version control is a nightmare
- Consultants spend significant time chasing document submissions and resending comments
- Banks have no real-time visibility into compliance status
- Audit trails are non-existent or require manual reconstruction

### 2.2 The Consequence

Loan disbursements get delayed. Compliance gaps go undetected until late. Consultant time is wasted on coordination overhead instead of actual assessment work. Banks face reputational and regulatory risk from poorly documented ESDD processes.

### 2.3 What Trace Changes

- **One platform** where all three parties work simultaneously
- **Structured Actions** so loanees know exactly what to submit
- **Real-time status** so banks and consultants can see progress without asking
- **Audit trail** so every decision, upload, and review is logged
- **Notification system** so no submission or review goes unnoticed

---

## 3. Target Users & Personas

### 3.1 Persona Matrix

| Persona | Org Type | Role | Primary Job in Trace |
|---------|----------|------|---------------------|
| **Platform Operator** | Trace (you) | Super Admin | Creates Bank workspaces, manages onboarding |
| **Arjun Krishnan** | Bank (HDFC) | Admin | Invites consultants, oversees compliance portfolio |
| **Kavya Nair** | Bank (HDFC) | Member | Monitors project progress |
| **Priya Kapoor** | Consultant (Ramboll) | Admin | Creates projects, drafts + publishes action plans, reviews submissions |
| **Naveen Rao** | Consultant (Ramboll) | Member | Reviews assigned Actions, posts comments |
| **Meera Sharma** | Loanee (Eldeco) | Admin | Assigns Actions to team, oversees submissions |
| **Rahul Verma** | Loanee (Eldeco) | Member | Uploads evidence, tracks assigned Actions |

### 3.2 Persona Deep Dives

#### Platform Operator (you)
- **Context:** The person running Trace. Has a super-admin account at `/admin`
- **Day-to-day:** Creates new Bank workspaces when onboarding a new bank customer. Sends the initial invite email to the Bank Admin.
- **Permissions:** Can create any workspace type. Can see a list of all workspaces. Cannot see project data.

#### Arjun Krishnan — Bank Admin
- **Context:** Senior Investment Officer — ESG at HDFC Capital
- **Day-to-day in Trace:** Inviting consultant firms to join HDFC's network, monitoring portfolio compliance, seeing action-level detail across projects
- **Pain points without Trace:** Relies entirely on consultant for status updates
- **Permissions:** Can invite consultant firms. Read-only on all project content. Can see all projects in their portfolio.
- **Success metric:** Full portfolio visibility in < 2 minutes

#### Priya Kapoor — Consultant Admin
- **Context:** Senior sustainability consultant responsible for Project Yamuna
- **Day-to-day in Trace:** Creating projects, drafting IFC-aligned Actions, publishing action plan to Eldeco, reviewing document uploads
- **Pain points without Trace:** Spends ~3–4 hours/week per project on email follow-up
- **Permissions:** Can create projects, draft and publish action plans, review deliverables, invite team and loanees
- **Success metric:** Time from submission to review decision < 24 hours

#### Meera Sharma — Loanee Admin
- **Context:** Head of Corporate HR at Eldeco, accountable for ESDD compliance
- **Day-to-day in Trace:** Assigning Actions to team members, monitoring completion %
- **Pain points without Trace:** Doesn't know which documents are missing until chased
- **Permissions:** Can see all Actions, assign Actions to team, submit documents, invite team members
- **Success metric:** Zero missed deadlines

#### Rahul Verma — Loanee Member
- **Context:** Corporate HR Manager, assigned to PS2 Actions
- **Day-to-day in Trace:** Uploading documents, responding to send-back comments
- **Permissions:** Can upload documents to assigned Actions, view submission status
- **Success metric:** First-time document acceptance rate > 80%

---

## 4. User Stories

### 4.1 Platform Admin

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| ADM1 | Platform Operator | log in to a protected admin panel at `/admin` | I can manage customer workspaces | MVP |
| ADM2 | Platform Operator | create a Bank workspace with a name and admin email | the Bank Admin receives an invite and can get started | MVP |
| ADM3 | Platform Operator | see a list of all workspaces and their types | I can monitor what's been created | MVP |

### 4.2 Authentication & Onboarding

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| A1 | Any invited user | receive an email with a secure invite link | I can create my account without a separate sign-up form | MVP |
| A2 | Any user | log in with email and password | I can access my workspace securely | MVP |
| A3 | Any user | reset my password via email | I can recover access if I forget | MVP |
| A4 | Workspace Admin | invite team members by email | they can join my workspace with a role | MVP |
| A5 | Bank Admin | invite a Consultant firm by sending an invite to their admin email | a Consultant workspace is created and they can join | MVP |
| A6 | Any user | switch between workspaces I belong to | I don't have to log out and back in | MVP |

### 4.3 Project Management

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| P1 | Consultant Admin | create a project specifying the Bank and Loanee | the ESDD process can begin | MVP |
| P2 | Any user | see all projects I'm a member of | I can navigate quickly | MVP |
| P3 | Bank Admin | see all projects in my portfolio | I can monitor overall compliance health | MVP |

### 4.4 Action Plan

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| AP1 | Consultant | draft an Action plan with IFC-aligned Actions and deliverables | the loanee knows exactly what's expected | MVP |
| AP2 | Consultant Admin | publish the Action plan | the loanee is notified and can begin submissions | MVP |
| AP3 | Consultant | edit Actions after publishing | I can add clarity or update requirements (changes logged) | MVP |
| AP4 | Consultant | view Actions in Board, Table, and Timeline views | I can manage work in my preferred format | v1.1 |

### 4.5 Document Submission

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| D1 | Loanee | upload a document against a specific deliverable | the consultant can review my evidence | MVP |
| D2 | Loanee | see the status of each deliverable I've submitted | I know what's approved and what needs rework | MVP |
| D3 | Loanee | re-upload a revised document when sent back | I can address the consultant's feedback | MVP |
| D4 | Loanee Admin | assign Actions to team members | the right person handles each deliverable | MVP |

### 4.6 Review & Approval

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| R1 | Consultant | see all submitted deliverables requiring review | I can prioritise my queue | MVP |
| R2 | Consultant | approve a submitted deliverable | the loanee knows it's accepted | MVP |
| R3 | Consultant | send back a deliverable with a comment | the loanee understands what to fix | MVP |
| R4 | Consultant | approve an Action once all deliverables are approved | it's marked complete for everyone | MVP |

### 4.7 Comments

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| C1 | Any project member | post a comment on an Action | I can communicate context to all parties | MVP |
| C2 | Comment author | edit or delete my own comment | I can correct mistakes | MVP |
| C3 | Any project member | see the full comment thread on an Action | I have context for decisions made | MVP |
| C4 | Any project member | @mention a colleague in a comment | they are notified directly | v1.1 |

### 4.8 Bank Oversight

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| B1 | Bank Admin | see a dashboard of all project statuses | I can monitor compliance without asking | MVP |
| B2 | Bank User | click into any project and see Action-level detail | I can review specific concerns | MVP |
| B3 | Bank Admin | generate an ESDD report | I have a document for internal reporting | v2 |

### 4.9 Notifications

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| N1 | Any user | receive an email when invited to a workspace | I know to join Trace | MVP |
| N2 | Consultant | receive an email when a loanee submits a deliverable | I can review promptly | MVP |
| N3 | Loanee | receive an email when my submission is reviewed | I can act on feedback immediately | MVP |
| N4 | Any user | receive an email when assigned an Action | I know my responsibilities | MVP |
| N5 | Any user | see in-app notifications for key events | I don't have to check email constantly | v1.1 |

### 4.10 Settings

| ID | As a... | I want to... | So that... | Priority |
|----|---------|--------------|-----------|----------|
| S1 | Workspace Admin | invite, change role, or remove team members | I control who has access | MVP |
| S2 | Any user | update my name and job title | I'm recognisable to collaborators | v1.1 |
| S3 | Workspace Admin | update workspace name | the workspace reflects our organisation | v1.1 |

---

## 5. Feature Requirements

### 5.1 MVP Feature Set

#### F1 — Platform Admin Panel
- Accessible at `/admin`, protected by `ADMIN_SECRET` environment variable
- Not linked from anywhere in the main app — URL-only access
- **Create workspace:** form with workspace name, type (Bank by default), Admin first name, Admin last name, Admin email → creates workspace in DB → sends invite email to Admin
- **Workspace list:** table showing all workspaces — name, type, created date, admin email, status (active/pending)
- Simple, functional UI — does not need to match Trace's design system

#### F2 — Authentication
- Email + password login
- Password reset via email
- Session expiry: 7 days
- Invite-only registration — no public sign-up page exists anywhere
- Email invite links with 7-day expiry
- Role assigned on invite (Admin / Member)
- Workspace switcher: users with multiple workspaces can switch without logging out

#### F3 — Workspace & Multi-tenancy
- Three workspace types: Bank, Consultant, Loanee
- Each workspace is fully isolated — users only see data from their own workspaces and shared projects
- A user can belong to multiple workspaces with different roles in each
- **Workspace creation chain:**
  - Bank: created by Platform Operator via admin panel
  - Consultant: created when Bank Admin invites a consultant firm (enter firm name + admin email → invite sent)
  - Loanee: created when Consultant Admin creates a project and specifies loanee (enter firm name + admin email → invite sent → workspace created immediately → loanee joined to project)

#### F4 — Projects
- Only Consultant Admin can create projects
- Projects have: name, description, IFC project category, location (state + city), construction start date, status
- A project links exactly one Bank workspace, one Consultant workspace, one Loanee workspace
- Project statuses (automatic, not manual for MVP):
  - `draft` — action plan not yet published
  - `in_progress` — action plan published, loanee is working
  - `requires_attention` — one or more Actions have a sent-back deliverable
  - `completed` — all Actions approved
- Projects visible to members of all three associated workspaces

#### F5 — Action Plan
- Consultant creates Actions within a project
- Each Action has:
  - Action number (auto-generated: `[CATEGORY]-[N]` per category within project, e.g. PS2-1, PS2-2, PS1-1)
  - IFC category (fixed list: Regulatory, PS1–PS8, C1)
  - Topic (short title)
  - Full recommendation text
  - One or more deliverables (labelled a, b, c...)
  - Target date
  - Priority (Critical / High / Medium / Low)
  - Department hint (informational — suggested team for loanee)
  - Status (automatic — see Business Rules)
- Each deliverable has: description, optional list of required document types, status
- Draft action plan is invisible to Loanee until published
- Consultant can edit Actions after publishing — changes are logged in activity log
- Action statuses (automatic):
  - `draft` — action plan not published yet
  - `in_progress` — published, loanee working on it
  - `requires_attention` — one or more deliverables sent back
  - `completed` — all deliverables approved

#### F6 — File Upload & Document Management
- Loanee uploads files against specific deliverables
- Accepted types: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP
- Max file size: 25MB per file
- Files stored securely — never publicly accessible, only via signed URLs (15-minute expiry)
- File name, upload date, uploader name, file size shown in UI
- Consultant and Bank can download any uploaded file
- Re-uploads after send-back create a new version — old file retained, new file becomes current
- Upload shows real-time progress bar

#### F7 — Review Workflow
- Consultant sees a review queue: all deliverables in status `submitted` or `resubmitted`
- Per deliverable: Approve or Send Back
- Send Back requires a written comment
- Once all deliverables in an Action are approved → Consultant can approve the Action
- Status transitions:
  - Deliverable: `not_started` → `submitted` → `approved` / `sent_back` → `resubmitted` → loop
  - Action: `draft` → `in_progress` → `completed` / `requires_attention`

#### F8 — Comments
- Any project member can post a comment on any Action
- Comments are visible to all three workspace types (Bank, Consultant, Loanee)
- Comment author can edit or delete their own comment
- Deleted comments show "Comment deleted" placeholder (not fully removed — audit trail)
- No @mentions in MVP (v1.1)
- Comments ordered chronologically, newest at bottom

#### F9 — Email Notifications
- All emails sent server-side (never client-side)
- Transactional emails:

| Event | Recipient | Email contains |
|-------|-----------|---------------|
| Workspace invite | Invited user | Invite link, workspace name, role |
| Action plan published | Loanee Admin | Project name, action count, link to project |
| Deliverable submitted | Assigned Consultant | Project, Action number, deliverable letter, link |
| Deliverable approved | Loanee submitter | Which deliverable, Action number, link |
| Deliverable sent back | Loanee submitter | Which deliverable, the comment, link |
| Action approved | Loanee Admin | Action number, project name, link |
| Action assigned | Assigned user | Action number, project name, link |
| Password reset | Requesting user | Secure reset link (via Clerk) |

- Emails sent from Resend. Sender address: default Resend address until domain is confirmed, then `notifications@[domain]`
- Every email contains a direct deep-link to the relevant item in the app

#### F10 — Empty States
All views must show the empty states designed in the prototype when no data exists. These include:
- No projects yet (all three personas)
- No Actions yet (Consultant before drafting)
- No deliverables submitted yet (Consultant review queue)
- No comments yet (Action detail)
- No members yet (Settings → Members)
- No activity yet (Activity log)
Prototype views `empty-*` are the visual reference for all empty states.

#### F11 — Activity Log
- Every significant event logged automatically:
  - User joins workspace
  - Project created
  - Action created / edited / published
  - Document uploaded
  - Deliverable approved / sent back
  - Action approved
  - Comment posted / edited / deleted
- Log entries show: who, what, when, on which item
- Visible to all project members
- Cannot be edited or deleted

#### F12 — Bank Dashboard
- All projects in portfolio visible with: name, consultant, loanee, % Actions complete, status, last activity date
- Click through to project detail — full read-only view
- Action-level detail visible (cannot approve/submit/comment)

### 5.2 Feature Behaviour Matrix

| Feature | Platform Admin | Bank Admin | Bank Member | Consultant Admin | Consultant Member | Loanee Admin | Loanee Member |
|---------|---------------|-----------|-------------|-----------------|-------------------|-------------|---------------|
| Create Bank workspace | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Invite Consultant firm | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create project | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| View all projects | ❌ | ✅ (portfolio) | ✅ (portfolio) | Own only | Own only | Own only | Own only |
| Draft Action plan | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Publish Action plan | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Upload document | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Review / approve | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Post comment | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View activity log | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invite workspace members | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |

---

## 6. User Flows

### 6.1 Master Flow — Full ESDD Lifecycle

```
PLATFORM OPERATOR (you)
│
├─► Logs into /admin with ADMIN_SECRET
├─► Creates HDFC Capital workspace
│     └─► Arjun (Bank Admin) receives invite email → clicks link → creates account
│
HDFC (Bank Admin — Arjun)
│
├─► Logs in to Trace
├─► Invites Ramboll Mumbai as a Consultant firm
│     (enters: firm name + Priya's email)
│     └─► Priya receives invite → creates Ramboll workspace → logs in
│
RAMBOLL (Consultant Admin — Priya)
│
├─► Creates Project "Project Yamuna"
│     ├─► Selects Bank: HDFC Capital (from dropdown — already in network)
│     ├─► Enters Loanee: Eldeco Group + Meera's email
│     │     └─► Eldeco workspace created immediately
│     │     └─► Meera receives invite → creates account → joins Eldeco workspace
│     │     └─► Project Yamuna is already there when she logs in
│
├─► Drafts Action Plan (22 Actions — invisible to Eldeco)
│
├─► Publishes Action Plan
│     └─► Meera receives email: "Action plan ready — 22 Actions to complete"
│
ELDECO (Loanee Admin — Meera)
│
├─► Logs in, sees 22 Actions
├─► Assigns Actions to team members
│     ├─► Rahul → PS2 Actions
│     └─► Others → their respective Actions
│
ELDECO (Loanee Member — Rahul)
│
├─► Opens Action PS2-1
├─► Uploads "Attendance_Records.pdf" against Deliverable (a)
│     └─► Priya receives email: "Rahul submitted PS2-1 (a)"
│
RAMBOLL (Consultant — Priya)
│
├─► Reviews PS2-1 deliverable (a)
│     ├─► Approves → Rahul notified ✅
│     └─► Sends back with comment → Rahul re-uploads → loop
│
├─► All deliverables approved → Approves Action PS2-1
│
[Repeat for all 22 Actions]
│
HDFC (Bank Admin — Arjun)
│
└─► Dashboard shows 22/22 Actions complete
```

### 6.2 Workspace Creation Chain

```
Platform Operator → creates Bank workspace → Bank Admin invited
                                                    │
                              Bank Admin → invites Consultant firm → Consultant Admin invited
                                                                              │
                                            Consultant Admin → creates project → specifies Loanee
                                                                                        │
                                                                 Loanee workspace created automatically
                                                                 Loanee Admin invited
```

### 6.3 Document Upload & Review Flow

```
Loanee opens Action detail → sees deliverable list with status chips
      │
      ▼
Clicks "Upload" on a deliverable → file picker opens
      │
      ├─► Validation (type + size) fails → error shown, no upload
      │
      └─► Validation passes → upload to R2 with progress bar
                │
                ▼
          Status → "Submitted" → email sent to Consultant
                │
                ▼
          Consultant reviews
                │
                ├─► Approve → status "Approved" → email to Loanee
                │
                └─► Send Back (comment required) → status "Sent Back"
                          → email to Loanee with comment
                          → Loanee re-uploads → status "Resubmitted"
                          → loop
```

---

## 7. Business Rules

### 7.1 Workspace Rules
- BR1: Workspace type is set at creation and never changes
- BR2: Each workspace always has at least one Admin. The last Admin cannot be removed or demoted.
- BR3: A user can belong to multiple workspaces, each with its own role
- BR4: Users switch between workspaces from within the app — no re-login required

### 7.2 Project Rules
- BR5: Only Consultant Admin can create projects in MVP
- BR6: A project links exactly one Bank + one Consultant + one Loanee workspace. These cannot change after creation.
- BR7: Project is visible to all members of all three associated workspaces
- BR8: The Loanee workspace is created at the moment the Consultant creates the project. The invite is sent immediately. If the invite is never accepted, the workspace exists but is empty.

### 7.3 Action Plan Rules
- BR9: Only users in the Consultant workspace can create, edit, or delete Actions
- BR10: While `is_published = false`, Actions are completely invisible to Loanee users
- BR11: Publishing triggers a notification to the Loanee Admin. It cannot be undone (but Actions can be edited post-publish)
- BR12: Action numbers are auto-generated as `[CATEGORY]-[N]` where N increments per category within the project. PS2-1, PS2-2, PS2-3 etc. Numbers are never reused even if an Action is deleted.
- BR13: Consultants can edit any Action field after publishing. All edits are written to the activity log.

### 7.4 Status Rules (automatic — not manual in MVP)
- BR14: Action status is computed automatically:
  - All deliverables `not_started` or mix of not_started/in_progress → `in_progress`
  - Any deliverable `sent_back` → `requires_attention`
  - All deliverables `approved` → `completed` (unlocks the "Approve Action" button for Consultant)
- BR15: Project status is computed automatically from Action statuses
- BR16: Manual status changes via board drag are deferred to v1.1

### 7.5 Document & Review Rules
- BR17: Only Loanee users can upload documents
- BR18: Only Consultant users can approve or send back deliverables
- BR19: Bank users are read-only on all documents and review decisions
- BR20: A deliverable can only be approved if a document has been uploaded against it
- BR21: An Action can only be approved when all its deliverables are individually approved
- BR22: Send Back requires a written comment. Approval does not.
- BR23: Re-uploads create a new document version. Old versions are retained. The latest version is always the one under review.

### 7.6 Comment Rules
- BR24: Any project member across all three workspace types can post comments on Actions
- BR25: Users can only edit or delete their own comments
- BR26: Deleted comments are soft-deleted — shown as "Comment deleted" in the thread
- BR27: Bank users can read and post comments (they are project stakeholders)

### 7.7 Notification Rules
- BR28: All email notifications are triggered server-side only
- BR29: Notifications are scoped to the project — no cross-project or cross-workspace bleed

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Page load: < 2 seconds on standard Indian broadband (10 Mbps)
- File upload progress: shown in real time via progress bar
- Dashboard data: max 30-second staleness (polling or on-focus refresh)

### 8.2 Security
- All data in transit: HTTPS only (TLS 1.2+)
- All data at rest: encrypted (managed by Neon + Cloudflare)
- File downloads: signed URLs only, 15-minute expiry
- Passwords: never stored in plain text (Clerk handles hashing)
- Sessions: 7-day expiry, secure HTTP-only cookies
- Row-level data isolation: users can only query data from their own workspaces/projects
- Admin panel: protected by `ADMIN_SECRET` env var, not linked from main app

### 8.3 Reliability
- Target uptime: 99.5% (managed by Vercel + Neon)
- Daily database backups (managed by Neon)
- Zero-downtime deploys (Vercel)

### 8.4 Compliance (India)
- Personal data stored in India (Mumbai hosting region)
- Privacy policy published before any real users onboard
- Data deletion available for users on request
- DPDP Act 2023 compliance planned before first paid customer

### 8.5 Browser Support
- Chrome, Edge, Firefox — latest 2 versions
- Desktop only — no mobile requirement for v1

### 8.6 Data Retention
- Active workspace data retained indefinitely
- Deleted accounts: personal data purged within 30 days
- Uploaded files retained as long as the project is active

---

## 9. Out of Scope for MVP

| Feature | Target Version |
|---------|---------------|
| Board / Table / Timeline project views | v1.1 |
| Manual Action status change (board drag) | v1.1 |
| @mention in comments | v1.1 |
| In-app notification bell | v1.1 |
| Document version history UI | v1.1 |
| Pinned projects in sidebar | v1.1 |
| Consultant / Loanee directory management UI | v1.1 |
| Settings: workspace branding (logo upload) | v1.1 |
| CSV import of members | v1.1 |
| Consultant editing Actions after publish | ✅ IN MVP |
| Documents tab (all project files in one view) | Removed |
| Real ESDD Report PDF generation | v2 |
| Billing / subscription management | v2 |
| Mobile responsive UI | v2 |
| SMS / WhatsApp notifications | v2 |
| Slack / Teams integration | v2 |
| Bank-initiated project creation | v2 |
| Self-service Bank workspace signup | v2 |

---

## 10. Success Metrics

### 10.1 MVP Success Criteria
- [ ] Platform Operator can log into `/admin` and create a Bank workspace
- [ ] Bank Admin receives invite, creates account, and can invite a Consultant
- [ ] Consultant receives invite, creates account, creates a project with Loanee
- [ ] Loanee receives invite, creates account, lands on project with Actions
- [ ] Consultant can draft 5+ Actions with deliverables and publish the plan
- [ ] Loanee can upload a document against a deliverable
- [ ] Consultant can approve or send back that document with a comment
- [ ] All 8 email notification types fire correctly
- [ ] Comments work across all three persona types
- [ ] Activity log records all key events
- [ ] Full loop works end-to-end with zero critical errors

### 10.2 Pitch Success Criteria
- [ ] Live URL exists (Vercel deployment)
- [ ] Three personas demonstrable without switching devices (use workspace switcher)
- [ ] Looks and feels like a real product — not a prototype
- [ ] 5-minute walkthrough communicates core value proposition clearly

### 10.3 Product-Market Fit Indicators
- Consultants use it for real projects (not just pilots)
- Loanees complete > 80% of Actions without being chased
- Banks check the dashboard without prompting at least 2× per week
- NPS > 40 among consultant users

---

*End of PRD v1.1 — Approved for Build*
