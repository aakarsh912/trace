import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const workspaceTypeEnum = pgEnum("workspace_type", [
  "bank",
  "consultant",
  "loanee",
]);

export const workspaceMemberRoleEnum = pgEnum("workspace_member_role", [
  "admin",
  "member",
]);

export const ifcCategoryEnum = pgEnum("ifc_category", [
  "regulatory",
  "ps1",
  "ps2",
  "ps3",
  "ps4",
  "ps6",
  "ps8",
  "c1",
]);

export const deliverableStatusEnum = pgEnum("deliverable_status", [
  "pending",
  "submitted",
  "approved",
  "sent_back",
]);

export const reviewDecisionEnum = pgEnum("review_decision", [
  "approved",
  "sent_back",
]);

export const inviteRoleEnum = pgEnum("invite_role", ["admin", "member"]);

// ─── Workspaces ───────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: workspaceTypeEnum("type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// ─── Workspace Members ────────────────────────────────────────────────────────

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    role: workspaceMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    uniqMember: uniqueIndex("uniq_workspace_member").on(
      t.workspaceId,
      t.userId
    ),
    workspaceIdx: index("workspace_members_workspace_idx").on(t.workspaceId),
    userIdx: index("workspace_members_user_idx").on(t.userId),
  })
);

// ─── Invites ──────────────────────────────────────────────────────────────────

export const invites = pgTable("invites", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(),
  email: text("email").notNull(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  role: inviteRoleEnum("role").notNull().default("member"),
  invitedById: text("invited_by_id").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    bankWorkspaceId: text("bank_workspace_id")
      .notNull()
      .references(() => workspaces.id),
    consultantWorkspaceId: text("consultant_workspace_id")
      .notNull()
      .references(() => workspaces.id),
    loaneeWorkspaceId: text("loanee_workspace_id")
      .notNull()
      .references(() => workspaces.id),
    isPublished: boolean("is_published").notNull().default(false),
    publishedAt: timestamp("published_at"),
    description: text("description"),
    locationCity: text("location_city"),
    locationState: text("location_state"),
    constructionStartDate: timestamp("construction_start_date"),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    bankIdx: index("projects_bank_idx").on(t.bankWorkspaceId),
    consultantIdx: index("projects_consultant_idx").on(
      t.consultantWorkspaceId
    ),
    loaneeIdx: index("projects_loanee_idx").on(t.loaneeWorkspaceId),
  })
);

// ─── Action Number Sequences ──────────────────────────────────────────────────

export const actionNumberSequences = pgTable(
  "action_number_sequences",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    ifcCategory: ifcCategoryEnum("ifc_category").notNull(),
    lastNumber: integer("last_number").notNull().default(0),
  },
  (t) => ({
    uniqSeq: uniqueIndex("uniq_action_sequence").on(
      t.projectId,
      t.ifcCategory
    ),
  })
);

// ─── Actions ──────────────────────────────────────────────────────────────────

export const actions = pgTable(
  "actions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id),
    actionNumber: text("action_number").notNull(),
    ifcCategory: ifcCategoryEnum("ifc_category").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    isPublished: boolean("is_published").notNull().default(false),
    priority: text("priority"), // critical | high | medium | low
    targetDate: timestamp("target_date"),
    departmentHint: text("department_hint"),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    projectIdx: index("actions_project_idx").on(t.projectId),
  })
);

// ─── Deliverables ─────────────────────────────────────────────────────────────

export const deliverables = pgTable(
  "deliverables",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actionId: text("action_id")
      .notNull()
      .references(() => actions.id),
    letter: text("letter").notNull(),
    description: text("description").notNull(),
    status: deliverableStatusEnum("status").notNull().default("pending"),
    assignedToId: text("assigned_to_id").references(() => users.id),
    dueDate: timestamp("due_date"),
    documentHints: text("document_hints"), // JSON array of hint strings
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    actionIdx: index("deliverables_action_idx").on(t.actionId),
  })
);

// ─── Documents ────────────────────────────────────────────────────────────────

export const documents = pgTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    deliverableId: text("deliverable_id")
      .notNull()
      .references(() => deliverables.id),
    uploadedById: text("uploaded_by_id").references(() => users.id),
    fileName: text("file_name").notNull(),
    fileKey: text("file_key").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    deliverableIdx: index("documents_deliverable_idx").on(t.deliverableId),
  })
);

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const reviews = pgTable(
  "reviews",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    deliverableId: text("deliverable_id")
      .notNull()
      .references(() => deliverables.id),
    documentId: text("document_id").references(() => documents.id),
    reviewedById: text("reviewed_by_id").references(() => users.id),
    decision: reviewDecisionEnum("decision").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    deliverableIdx: index("reviews_deliverable_idx").on(t.deliverableId),
  })
);

// ─── Comments ─────────────────────────────────────────────────────────────────

export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    actionId: text("action_id")
      .notNull()
      .references(() => actions.id),
    authorId: text("author_id").references(() => users.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
  },
  (t) => ({
    actionIdx: index("comments_action_idx").on(t.actionId),
  })
);

// ─── Activity Log ─────────────────────────────────────────────────────────────

export const activityLog = pgTable(
  "activity_log",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    workspaceId: text("workspace_id").references(() => workspaces.id),
    projectId: text("project_id").references(() => projects.id),
    actorId: text("actor_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    entityId: text("entity_id"),
    entityType: text("entity_type"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    workspaceIdx: index("activity_log_workspace_idx").on(t.workspaceId),
    projectIdx: index("activity_log_project_idx").on(t.projectId),
  })
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;

export type WorkspaceType = "bank" | "consultant" | "loanee";
export type WorkspaceMemberRole = "admin" | "member";
export type IfcCategory =
  | "regulatory"
  | "ps1"
  | "ps2"
  | "ps3"
  | "ps4"
  | "ps6"
  | "ps8"
  | "c1";
export type DeliverableStatus = "pending" | "submitted" | "approved" | "sent_back";
export type ReviewDecision = "approved" | "sent_back";
export type ActionStatus =
  | "draft"
  | "in_progress"
  | "requires_attention"
  | "completed";
