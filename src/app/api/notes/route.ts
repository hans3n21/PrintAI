import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!m) return null;
  try {
    return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
  } catch {
    return null;
  }
}

async function uploadNoteScreenshot(pagePath: string, dataUrl: string) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error("Invalid screenshot data URL");
  }
  const ext =
    parsed.mime === "image/png"
      ? "png"
      : parsed.mime === "image/jpeg" || parsed.mime === "image/jpg"
        ? "jpg"
        : "webp";
  const safePath = pagePath.replace(/[^a-zA-Z0-9/_-]/g, "_").replace(/\/+/g, "_");
  const filename = `notes/${safePath}_${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("designs")
    .upload(filename, parsed.buffer, { contentType: parsed.mime, upsert: true });
  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("designs").getPublicUrl(filename);
  return data.publicUrl;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("feedback_notes")
    .select("id, created_at, page_path, note, screenshot_url, resolved, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ notes: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      note?: string;
      page_path?: string;
      screenshot_base64?: string;
    };
    const note = (body.note ?? "").trim();
    const pagePath = (body.page_path ?? "").trim();
    if (!note) {
      return NextResponse.json({ error: "note required" }, { status: 400 });
    }
    if (!pagePath) {
      return NextResponse.json({ error: "page_path required" }, { status: 400 });
    }

    let screenshotUrl: string | null = null;
    if (body.screenshot_base64?.trim()) {
      screenshotUrl = await uploadNoteScreenshot(pagePath, body.screenshot_base64);
    }

    const { data, error } = await supabaseAdmin
      .from("feedback_notes")
      .insert({
        page_path: pagePath,
        note,
        screenshot_url: screenshotUrl,
        resolved: false,
        resolved_at: null,
      })
      .select("id, created_at, page_path, note, screenshot_url, resolved, resolved_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; resolved?: boolean };
    const id = (body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    if (typeof body.resolved !== "boolean") {
      return NextResponse.json({ error: "resolved boolean required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("feedback_notes")
      .update({
        resolved: body.resolved,
        resolved_at: body.resolved ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, created_at, page_path, note, screenshot_url, resolved, resolved_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ note: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("feedback_notes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
