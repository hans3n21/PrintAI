import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const PRINT_FILES_BUCKET = "print-files";

type SessionPrintConfig = Record<string, unknown> & {
  print_file?: {
    url: string;
    storage_path: string;
  };
};

async function fetchSelectedDesignPng(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Selected design could not be downloaded (${response.status})`);
  }

  const buffer = await response.arrayBuffer();
  return new Blob([buffer], { type: "image/png" });
}

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: unknown };
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const normalizedSessionId = sessionId.trim();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("selected_design_url, config")
      .eq("id", normalizedSessionId)
      .single();

    if (sessionError || !session?.selected_design_url) {
      return NextResponse.json(
        { error: sessionError?.message ?? "selected_design_url missing" },
        { status: sessionError ? 500 : 404 }
      );
    }

    const storagePath = `${normalizedSessionId}/print-file.png`;
    const file = await fetchSelectedDesignPng(session.selected_design_url);
    const bucket = supabaseAdmin.storage.from(PRINT_FILES_BUCKET);
    const { error: uploadError } = await bucket.upload(storagePath, file, {
      contentType: "image/png",
      upsert: true,
    });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = bucket.getPublicUrl(storagePath);
    const result = {
      url: data.publicUrl,
      storage_path: storagePath,
    };
    const config = (session.config ?? {}) as SessionPrintConfig;

    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        config: {
          ...config,
          print_file: result,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", normalizedSessionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/print-file/upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
