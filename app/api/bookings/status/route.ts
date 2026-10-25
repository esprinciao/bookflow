import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Polled by the booking page while it waits for the payment webhook. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_status", {
    p_booking_id: id,
  });

  if (error) {
    return NextResponse.json({ error: "Could not read status." }, { status: 500 });
  }
  return NextResponse.json(data ?? { status: "unknown" });
}

export const dynamic = "force-dynamic";
