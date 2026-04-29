import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE } from "@/lib/adminAuth";

const { cookiesMock, fromMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  fromMock: vi.fn(),
}));
const { storageFromMock } = vi.hoisted(() => ({
  storageFromMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

import { DELETE, GET } from "../route";

function mockAdminCookie(value: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) =>
      name === ADMIN_COOKIE_NAME && value ? { value } : undefined,
  });
}

function mockQuery(result: unknown) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(result)),
    eq: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
  };
  fromMock.mockReturnValue(query);
  return query;
}

function mockDeleteTables() {
  const ordersDelete = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  }));
  const sessionsDelete = vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve({ error: null })),
  }));
  fromMock.mockImplementation((table: string) => {
    if (table === "orders") return { delete: ordersDelete };
    if (table === "sessions") return { delete: sessionsDelete };
    return {};
  });
  return { ordersDelete, sessionsDelete };
}

function mockStorageDelete() {
  const list = vi.fn(() =>
    Promise.resolve({
      data: [
        { name: "design_1.png", id: "1" },
        { name: "creative_brief.json", id: "2" },
      ],
      error: null,
    })
  );
  const remove = vi.fn(() => Promise.resolve({ error: null }));
  storageFromMock.mockReturnValue({ list, remove });
  return { list, remove };
}

const fullSession = {
  id: "session-1",
  created_at: "2026-04-29T00:00:00.000Z",
  updated_at: "2026-04-29T00:05:00.000Z",
  status: "designing",
  conversation_history: [{ role: "user", content: "Vereinsshirt" }],
  onboarding_data: {
    event_type: "verein",
    style: "modern",
    product: "tshirt",
    tonality: "ernst",
  },
  product_selection: {
    product: "tshirt",
    product_color: "navy",
    quantity: 12,
  },
  creative_brief: {
    source_summary: "Teamshirt mit Logo vorne und Nummer hinten.",
    theme: "Vereinsshirt",
  },
  prompt_data: { prompt: "prompt" },
  design_urls: ["https://example.com/design.png"],
  design_assets: [{ id: "asset-1" }],
  reference_images: [],
  slogans: [{ main_text: "Teamgeist" }],
  selected_design_url: null,
  selected_slogan: null,
  config: { print_area: "both" },
};

describe("GET /api/admin/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests without a valid admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await GET(new Request("https://example.com/api/admin/sessions"));

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("returns lightweight session summaries without heavy detail fields", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockQuery({ data: [fullSession], error: null });

    const response = await GET(new Request("https://example.com/api/admin/sessions"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.sessions).toHaveLength(1);
    expect(json.sessions[0]).toMatchObject({
      id: "session-1",
      status: "designing",
      product: "tshirt",
      product_color: "navy",
      quantity: 12,
      thumbnail_url: "https://example.com/design.png",
      has_chat: true,
      has_designs: true,
      slogan_count: 1,
    });
    expect(json.sessions[0]).not.toHaveProperty("conversation_history");
    expect(json.sessions[0]).not.toHaveProperty("creative_brief");
    expect(json.sessions[0]).not.toHaveProperty("design_assets");
  });

  it("returns full details only when a session id and include=details are requested", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    mockQuery({ data: fullSession, error: null });

    const response = await GET(
      new Request("https://example.com/api/admin/sessions?id=session-1&include=details")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.session.id).toBe("session-1");
    expect(json.session.conversation_history).toEqual(fullSession.conversation_history);
    expect(json.session.creative_brief).toEqual(fullSession.creative_brief);
    expect(json.session.design_assets).toEqual(fullSession.design_assets);
  });
});

describe("DELETE /api/admin/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects delete requests without a valid admin cookie", async () => {
    mockAdminCookie(undefined);

    const response = await DELETE(
      new Request("https://example.com/api/admin/sessions?id=session-1")
    );

    expect(response.status).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("deletes session storage files, related orders and the session row", async () => {
    mockAdminCookie(ADMIN_COOKIE_VALUE);
    const { list, remove } = mockStorageDelete();
    const { ordersDelete, sessionsDelete } = mockDeleteTables();

    const response = await DELETE(
      new Request("https://example.com/api/admin/sessions?id=session-1")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ ok: true, deleted_storage_files: 2 });
    expect(list).toHaveBeenCalledWith("session-1", { limit: 100 });
    expect(remove).toHaveBeenCalledWith([
      "session-1/design_1.png",
      "session-1/creative_brief.json",
    ]);
    expect(ordersDelete).toHaveBeenCalled();
    expect(sessionsDelete).toHaveBeenCalled();
  });
});
