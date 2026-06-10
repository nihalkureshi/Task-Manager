import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error("get users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
