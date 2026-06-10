import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { verifyTaskOwnership } from "@/lib/server/tasks";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const taskId = Number((await params).id);
    const data = await request.json();
    const userEmail = request.headers.get("X-User-Email");

    const auth = await verifyTaskOwnership(taskId, userEmail);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabase();
    const { data: updated, error } = await supabase
      .from("tasks")
      .update({ notes: data?.notes || "" })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message: "Notes updated", task: updated });
  } catch (error) {
    console.error("update notes error:", error);
    return NextResponse.json({ error: "Failed to update notes" }, { status: 500 });
  }
}
