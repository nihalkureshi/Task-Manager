import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { isValidEmail, verifyTaskOwnership } from "@/lib/server/tasks";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const taskId = Number((await params).id);
    const data = await request.json();
    const userEmail = request.headers.get("X-User-Email");

    const auth = await verifyTaskOwnership(taskId, userEmail);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!data?.title || !data?.description || !data?.assigned_to) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidEmail(data.assigned_to)) {
      return NextResponse.json({ error: "Invalid assignee email address" }, { status: 400 });
    }

    if (data.assigned_to === userEmail) {
      return NextResponse.json({ error: "Cannot assign task to yourself" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: updated, error } = await supabase
      .from("tasks")
      .update({
        title: data.title,
        description: data.description,
        assigned_to: data.assigned_to,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: "Task updated", task: updated });
  } catch (error) {
    console.error("update task error:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
