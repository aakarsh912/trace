import { cookies } from "next/headers";

export const ADMIN_COOKIE = "admin_session";

export function isAdminAuthed(): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const value = cookies().get(ADMIN_COOKIE)?.value;
  return value === secret;
}
