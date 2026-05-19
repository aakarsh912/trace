import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

type Permission =
  // Projects
  | "project:create"
  | "project:read"
  | "project:publish"
  // Actions
  | "action:create"
  | "action:edit"
  | "action:delete"
  | "action:read"
  // Deliverables
  | "deliverable:create"
  | "deliverable:edit"
  | "deliverable:assign"
  // Documents
  | "document:upload"
  // Reviews
  | "review:approve"
  | "review:send_back"
  // Comments
  | "comment:create"
  | "comment:edit_own"
  | "comment:delete_own"
  // Members
  | "member:invite"
  | "member:remove"
  | "member:change_role"
  // Settings
  | "settings:edit";

const permissionMap: Record<
  WorkspaceType,
  Record<WorkspaceMemberRole, Permission[]>
> = {
  bank: {
    admin: [
      "project:read",
      "action:read",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
      "member:invite",
      "member:remove",
      "member:change_role",
      "settings:edit",
    ],
    member: [
      "project:read",
      "action:read",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
    ],
  },
  consultant: {
    admin: [
      "project:create",
      "project:read",
      "project:publish",
      "action:create",
      "action:edit",
      "action:delete",
      "action:read",
      "deliverable:create",
      "deliverable:edit",
      "deliverable:assign",
      "review:approve",
      "review:send_back",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
      "member:invite",
      "member:remove",
      "member:change_role",
      "settings:edit",
    ],
    member: [
      "project:read",
      "action:create",
      "action:edit",
      "action:read",
      "deliverable:create",
      "deliverable:edit",
      "review:approve",
      "review:send_back",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
    ],
  },
  loanee: {
    admin: [
      "project:read",
      "action:read",
      "deliverable:assign",
      "document:upload",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
      "member:invite",
      "member:remove",
      "member:change_role",
      "settings:edit",
    ],
    member: [
      "project:read",
      "action:read",
      "document:upload",
      "comment:create",
      "comment:edit_own",
      "comment:delete_own",
    ],
  },
};

export function can(
  workspaceType: WorkspaceType,
  role: WorkspaceMemberRole,
  permission: Permission
): boolean {
  return permissionMap[workspaceType][role].includes(permission);
}
