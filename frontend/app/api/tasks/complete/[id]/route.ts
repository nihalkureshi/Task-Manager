import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/server/email";
import { getSupabase } from "@/lib/server/supabase";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const taskId = Number((await params).id);
    const userEmail = request.headers.get("X-User-Email");

    if (!userEmail) {
      return NextResponse.json({ error: "User email required" }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: taskData, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!taskData) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (taskData.assigned_to !== userEmail && taskData.created_by !== userEmail) {
      return NextResponse.json({ error: "Not authorized to complete this task" }, { status: 403 });
    }

    if (taskData.status === "completed") {
      return NextResponse.json({ error: "Task already completed" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("tasks")
      .update({ status: "completed" })
      .eq("id", taskId)
      .select()
      .single();

    if (error) throw error;

    const notifyEmail =
      userEmail === taskData.assigned_to ? taskData.created_by : taskData.assigned_to;

    const emailSent = await sendEmail(
      notifyEmail,
      "Task Completed",
      "A task has been marked as completed.",
      {
        Title: taskData.title,
        "Completed by": userEmail,
      }
    );

    return NextResponse.json({
      message: "Task completed",
      task: updated,
      email_sent: emailSent,
      email_to: emailSent ? notifyEmail : null,
    });
  } catch (error) {
    console.error("complete task error:", error);
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
  }
}
