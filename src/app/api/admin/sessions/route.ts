import { ADMIN_COOKIE_NAME, isAdminCookieValid } from "@/lib/adminAuth";
import { collectDisplayDesignUrls } from "@/lib/designPageGeneration";
import { supabaseAdmin } from "@/lib/supabase";
import type {
  ChatMessage,
  CreativeBrief,
  DesignAsset,
  OnboardingData,
  ProductSelection,
  PromptData,
  ReferenceImageAsset,
  SessionConfig,
  SessionStatus,
  SloganOption,
} from "@/lib/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type SessionRow = {
  id: string;
  created_at: string;
  updated_at: string;
  status: SessionStatus;
  conversation_history?: ChatMessage[] | null;
  onboarding_data?: Partial<OnboardingData> | null;
  product_selection?: ProductSelection | null;
  creative_brief?: Partial<CreativeBrief> | null;
  prompt_data?: PromptData | null;
  design_urls?: string[] | null;
  design_assets?: DesignAsset[] | null;
  reference_images?: ReferenceImageAsset[] | null;
  slogans?: SloganOption[] | null;
  selected_design_url?: string | null;
  selected_slogan?: SloganOption | null;
  config?: Partial<SessionConfig> | null;
};

async function requireAdmin() {
  const cookieStore = await cookies();
  if (isAdminCookieValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    return null;
  }
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

function summarizeSession(row: SessionRow) {
  const designUrls = collectDisplayDesignUrls(row);
  const slogans = row.slogans ?? [];
  const history = row.conversation_history ?? [];
  const onboarding = row.onboarding_data ?? {};
  const productSelection = row.product_selection;
  const creativeBrief = row.creative_brief ?? {};
  const thumbnailUrl = row.selected_design_url ?? designUrls[0] ?? null;
  const sourceSummary =
    typeof creativeBrief.source_summary === "string"
      ? creativeBrief.source_summary
      : null;
  const theme = typeof creativeBrief.theme === "string" ? creativeBrief.theme : null;

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status,
    product: productSelection?.product ?? onboarding.product ?? null,
    product_color: productSelection?.product_color ?? null,
    quantity: productSelection?.quantity ?? null,
    event_type: onboarding.event_type ?? null,
    style: onboarding.style ?? null,
    summary: sourceSummary ?? theme ?? "Noch keine Zusammenfassung vorhanden",
    thumbnail_url: thumbnailUrl,
    design_count: designUrls.length,
    has_designs: designUrls.length > 0,
    has_chat: history.length > 0,
    slogan_count: slogans.length,
  };
}

function detailSession(row: SessionRow) {
  return {
    ...summarizeSession(row),
    conversation_history: row.conversation_history ?? [],
    onboarding_data: row.onboarding_data ?? null,
    product_selection: row.product_selection ?? null,
    creative_brief: row.creative_brief ?? null,
    prompt_data: row.prompt_data ?? null,
    design_urls: row.design_urls ?? [],
    design_assets: row.design_assets ?? [],
    reference_images: row.reference_images ?? [],
    slogans: row.slogans ?? [],
    selected_design_url: row.selected_design_url ?? null,
    selected_slogan: row.selected_slogan ?? null,
    config: row.config ?? {},
  };
}

const SUMMARY_SELECT =
  "id, created_at, updated_at, status, conversation_history, onboarding_data, product_selection, creative_brief, design_urls, design_assets, selected_design_url, slogans";

const DETAIL_SELECT =
  "id, created_at, updated_at, status, conversation_history, onboarding_data, product_selection, creative_brief, prompt_data, design_urls, design_assets, reference_images, slogans, selected_design_url, selected_slogan, config";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  const include = (url.searchParams.get("include") ?? "").trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

  if (id && include === "details") {
    const { data, error } = await supabaseAdmin
      .from("sessions")
      .select(DETAIL_SELECT)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Session not found" },
        { status: error ? 500 : 404 }
      );
    }

    return NextResponse.json({ session: detailSession(data as SessionRow) });
  }

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(SUMMARY_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessions: ((data ?? []) as SessionRow[]).map(summarizeSession),
  });
}

async function deleteSessionStorageFiles(sessionId: string) {
  const bucket = supabaseAdmin.storage.from("designs");
  const { data, error } = await bucket.list(sessionId, { limit: 100 });
  if (error) {
    throw new Error(`Storage list failed: ${error.message}`);
  }

  const paths = (data ?? [])
    .filter((item) => item.name && item.name !== ".emptyFolderPlaceholder")
    .map((item) => `${sessionId}/${item.name}`);

  if (paths.length === 0) return 0;

  const { error: removeError } = await bucket.remove(paths);
  if (removeError) {
    throw new Error(`Storage remove failed: ${removeError.message}`);
  }
  return paths.length;
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const deletedStorageFiles = await deleteSessionStorageFiles(id);

    const { error: orderError } = await supabaseAdmin
      .from("orders")
      .delete()
      .eq("session_id", id);
    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    const { error } = await supabaseAdmin.from("sessions").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      deleted_storage_files: deletedStorageFiles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown delete error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
