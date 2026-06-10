import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/server/email";
import { getSupabase } from "@/lib/server/supabase";
import { isValidEmail } from "@/lib/server/tasks";

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data?.title || !data?.description || !data?.assigned_to || !data?.created_by) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!isValidEmail(data.assigned_to)) {
      return NextResponse.json({ error: "Invalid assignee email address" }, { status: 400 });
    }

    if (data.assigned_to === data.created_by) {
      return NextResponse.json({ error: "Cannot assign task to yourself" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: result, error } = await supabase
      .from("tasks")
      .insert({
        title: data.title,
        description: data.description,
        assigned_to: data.assigned_to,
        created_by: data.created_by,
        notes: data.notes || "",
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    const assignee = data.assigned_to as string;
    const emailSent = await sendEmail(
      assignee,
      "New Task Assigned",
      "You have been assigned a new task.",
      {
        Title: data.title,
        Description: data.description,
        "Created by": data.created_by,
      }
    );

    return NextResponse.json({
      message: "Task created",
      task: result,
      email_sent: emailSent,
      email_to: emailSent ? assignee : null,
    });
  } catch (error) {
    console.error("create task error:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
