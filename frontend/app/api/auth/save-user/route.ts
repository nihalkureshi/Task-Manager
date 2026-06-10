import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const email = data?.email;
    const name = data?.name;

    if (!email || !name) {
      return NextResponse.json({ error: "Email and name are required" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase.from("users").select("*").eq("email", email).maybeSingle();

    if (!existing) {
      await supabase.from("users").insert({
        id: randomUUID(),
        name,
        email,
      });
    }

    return NextResponse.json({ message: "User saved" });
  } catch (error) {
    console.error("save-user error:", error);
    return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
  }
}
