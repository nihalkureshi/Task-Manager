import { getSupabase } from "./supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string | undefined | null): boolean {
  return Boolean(email && EMAIL_REGEX.test(email));
}

export async function verifyTaskOwnership(taskId: number, userEmail: string | null) {
  if (!userEmail) {
    return { ok: false as const, status: 401, error: "User email required" };
  }

  const { data, error } = await getSupabase()
    .from("tasks")
    .select("created_by")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return { ok: false as const, status: 404, error: "Task not found" };
  }
  if (data.created_by !== userEmail) {
    return { ok: false as const, status: 403, error: "Not authorized to modify this task" };
  }

  return { ok: true as const };
}
