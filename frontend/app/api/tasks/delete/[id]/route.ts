import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { verifyTaskOwnership } from "@/lib/server/tasks";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const taskId = Number((await params).id);
    const userEmail = request.headers.get("X-User-Email");

    const auth = await verifyTaskOwnership(taskId, userEmail);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) throw error;

    return NextResponse.json({ message: "Task deleted" });
  } catch (error) {
    console.error("delete task error:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
