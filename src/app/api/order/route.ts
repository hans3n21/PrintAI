import { createPrintfulDraftOrderForSession } from "@/lib/orders/printfulFulfillment";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { sessionId } = (await request.json()) as { sessionId?: unknown };

    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const result = await createPrintfulDraftOrderForSession(sessionId.trim());
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "printful_variant_id and print_file.url required" ||
      message === "sessionId required"
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
