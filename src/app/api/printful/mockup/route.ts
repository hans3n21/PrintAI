import { getJson, postJson } from "@/lib/printful/client";
import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MAX_POLL_ATTEMPTS = 8;

type PlacementConfig = {
  placement?: string;
  area_width?: number;
  area_height?: number;
  width?: number;
  height?: number;
  top?: number;
  left?: number;
};

type PrintFileConfig = {
  url?: string;
  storage_path?: string;
};

type SessionConfig = Record<string, unknown> & {
  sizes?: Record<string, string>;
  size?: string;
  placement?: PlacementConfig;
  print_file?: PrintFileConfig;
  mockups?: MockupResult[];
};

type MockupRequestBody = {
  sessionId?: unknown;
  printfulProductId?: unknown;
  printfulVariantId?: unknown;
  imageUrl?: unknown;
  placement?: unknown;
};

type SessionProductSelection = {
  printful_product_id?: number;
  printful_variant_id?: number;
  size?: string;
  color?: string;
};

type ProductVariant = {
  variant_id: number;
  size?: string | null;
  color?: string | null;
};

type PrintfulProduct = {
  printful_product_id: number;
  variants?: ProductVariant[] | null;
  print_area?: {
    placement?: string | null;
    area_width?: number | null;
    area_height?: number | null;
  } | null;
};

type CreateTaskResponse = {
  result?: {
    task_key?: string;
  };
  task_key?: string;
};

type TaskResponse = {
  result?: {
    status?: string;
    mockups?: Array<{
      variant_ids?: number[];
      variant_id?: number; // kept for safety, API actually uses variant_ids
      mockup_url?: string;
      mockup_url_png?: string;
      extra?: Array<{ url?: string }>;
    }>;
  };
};

type MockupResult = {
  variant_id: number;
  mockup_url: string;
  color?: string;
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getSelectedSize(config: SessionConfig, productSelection?: SessionProductSelection | null) {
  if (typeof productSelection?.size === "string" && productSelection.size.trim()) {
    return productSelection.size.trim().toUpperCase();
  }
  if (typeof config.size === "string" && config.size.trim()) {
    return config.size.trim().toUpperCase();
  }
  const firstSize = Object.values(config.sizes ?? {}).find(
    (value) => typeof value === "string" && value.trim()
  );
  return typeof firstSize === "string" ? firstSize.trim().toUpperCase() : "M";
}

function selectVariantIds(
  variants: ProductVariant[],
  size: string,
  productSelection?: SessionProductSelection | null
) {
  const selectedColor = productSelection?.color?.trim().toLowerCase();
  return variants
    .filter(
      (variant) =>
        variant.size?.trim().toUpperCase() === size &&
        (!selectedColor || variant.color?.trim().toLowerCase() === selectedColor)
    )
    .sort((a, b) => (a.color ?? "").localeCompare(b.color ?? ""))
    .map((variant) => variant.variant_id);
}

function buildPosition(config: SessionConfig, product: PrintfulProduct) {
  const placement = config.placement ?? {};
  const printArea = product.print_area ?? {};
  return {
    placement: placement.placement ?? printArea.placement ?? "front_large",
    area_width: placement.area_width ?? printArea.area_width ?? 1800,
    area_height: placement.area_height ?? printArea.area_height ?? 2400,
    width: placement.width ?? 1260,
    height: placement.height ?? 1680,
    top: placement.top ?? 360,
    left: placement.left ?? 270,
  };
}

function isPlacementConfig(value: unknown): value is PlacementConfig {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function placementFromRequest(value: unknown): PlacementConfig | undefined {
  if (!isPlacementConfig(value)) return undefined;
  return value;
}

function numberFromRequest(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeMockups(
  response: TaskResponse,
  variantsById: Map<number, ProductVariant>
): MockupResult[] {
  return (response.result?.mockups ?? []).flatMap((mockup) => {
    const mockupUrl =
      mockup.mockup_url ?? mockup.mockup_url_png ?? mockup.extra?.find((item) => item.url)?.url;
    if (typeof mockupUrl !== "string") return [];

    // Printful returns variant_ids (array). Fall back to variant_id for safety.
    const ids: number[] =
      Array.isArray(mockup.variant_ids) && mockup.variant_ids.length > 0
        ? mockup.variant_ids
        : typeof mockup.variant_id === "number"
          ? [mockup.variant_id]
          : [];

    return ids.map((id) => ({
      variant_id: id,
      mockup_url: mockupUrl,
      color: variantsById.get(id)?.color ?? undefined,
    }));
  });
}

async function pollMockupTask(taskKey: string, variantsById: Map<number, ProductVariant>) {
  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
    const response = await getJson<TaskResponse>(
      `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`
    );
    if (response.result?.status === "completed") {
      return normalizeMockups(response, variantsById);
    }
    if (response.result?.status === "failed") {
      throw new Error("Printful mockup task failed");
    }
    await sleep(Math.min(4000, 500 * attempt));
  }
  throw new Error("Printful mockup task timed out");
}

async function loadSessionProduct(productSelection?: SessionProductSelection | null) {
  const selectedPrintfulProductId = productSelection?.printful_product_id;
  if (Number.isInteger(selectedPrintfulProductId) && selectedPrintfulProductId > 0) {
    return supabaseAdmin
      .from("printful_products")
      .select("printful_product_id, variants, print_area")
      .eq("printful_product_id", selectedPrintfulProductId)
      .eq("is_active", true)
      .single();
  }

  return supabaseAdmin
    .from("printful_products")
    .select("printful_product_id, variants, print_area")
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .limit(1)
    .single();
}

async function loadPrintfulProduct(productId: number | undefined, productSelection?: SessionProductSelection | null) {
  const selectedPrintfulProductId =
    productId ??
    (Number.isInteger(productSelection?.printful_product_id) && productSelection!.printful_product_id! > 0
      ? productSelection!.printful_product_id
      : undefined);
  if (selectedPrintfulProductId) {
    return supabaseAdmin
      .from("printful_products")
      .select("printful_product_id, variants, print_area")
      .eq("printful_product_id", selectedPrintfulProductId)
      .eq("is_active", true)
      .single();
  }

  return loadSessionProduct(productSelection);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MockupRequestBody;
    const { sessionId } = body;
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const normalizedSessionId = sessionId.trim();
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("sessions")
      .select("selected_design_url, config, product_selection")
      .eq("id", normalizedSessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError?.message ?? "Session not found" },
        { status: sessionError ? 500 : 404 }
      );
    }

    const config = (session.config ?? {}) as SessionConfig;
    const imageUrl =
      (typeof body.imageUrl === "string" && body.imageUrl.trim()) ||
      config.print_file?.url ||
      (typeof session.selected_design_url === "string" ? session.selected_design_url : undefined);
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl or config.print_file.url missing" }, { status: 400 });
    }

    const productSelection = session.product_selection as SessionProductSelection | null;
    const { data: product, error: productError } = await loadPrintfulProduct(
      numberFromRequest(body.printfulProductId),
      productSelection
    );

    if (productError || !product) {
      return NextResponse.json(
        { error: productError?.message ?? "Printful product not found" },
        { status: productError ? 500 : 404 }
      );
    }

    const normalizedProduct = product as PrintfulProduct;
    const requestPlacement = placementFromRequest(body.placement);
    const position = buildPosition(
      requestPlacement ? ({ ...config, placement: requestPlacement } as SessionConfig) : config,
      normalizedProduct
    );
    const variantsById = new Map(
      (normalizedProduct.variants ?? []).map((variant) => [variant.variant_id, variant])
    );
    const requestedVariantId = numberFromRequest(body.printfulVariantId);
    const variantIds = requestedVariantId
      ? [requestedVariantId]
      : selectVariantIds(
          normalizedProduct.variants ?? [],
          getSelectedSize(config, productSelection),
          productSelection
        );
    if (variantIds.length === 0) {
      return NextResponse.json({ error: "No matching variants found" }, { status: 400 });
    }

    const createResponse = await postJson<CreateTaskResponse>(
      `/mockup-generator/create-task/${normalizedProduct.printful_product_id}`,
      {
        variant_ids: variantIds,
        format: "png",
        files: [
          {
            placement: position.placement,
            image_url: imageUrl,
            position: {
              area_width: position.area_width,
              area_height: position.area_height,
              width: position.width,
              height: position.height,
              top: position.top,
              left: position.left,
            },
          },
        ],
      }
    );
    const taskKey = createResponse.result?.task_key ?? createResponse.task_key;
    if (!taskKey) {
      return NextResponse.json({ error: "Printful task_key missing" }, { status: 500 });
    }

    const mockups = await pollMockupTask(taskKey, variantsById);
    const { error: updateError } = await supabaseAdmin
      .from("sessions")
      .update({
        config: {
          ...config,
          mockups,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", normalizedSessionId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ mockups });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/printful/mockup]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
