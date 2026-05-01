import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, storageFromMock, uploadMock, getPublicUrlMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  storageFromMock: vi.fn(),
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

import { POST } from "../route";

function mockSessionQuery(session: Record<string, unknown>) {
  const single = vi.fn(() => Promise.resolve({ data: session, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, single };
}

function mockSessionUpdate() {
  const eq = vi.fn(() => Promise.resolve({ error: null }));
  const update = vi.fn(() => ({ eq }));
  return { update, eq };
}

describe("POST /api/print-file/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageFromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/print-file.png" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([137, 80, 78, 71]), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
      )
    );
  });

  it("requires a sessionId", async () => {
    const response = await POST(
      new Request("https://example.com/api/print-file/upload", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("downloads the selected design and stores it in the public print-files bucket", async () => {
    const query = mockSessionQuery({
      selected_design_url: "https://example.com/design.png",
      config: { placement: { placement: "front_large" } },
    });
    const update = mockSessionUpdate();
    fromMock.mockImplementation((table: string) => {
      if (table === "sessions") {
        if (fromMock.mock.calls.filter(([name]) => name === "sessions").length === 1) {
          return { select: query.select };
        }
        return { update: update.update };
      }
      return {};
    });

    const response = await POST(
      new Request("https://example.com/api/print-file/upload", {
        method: "POST",
        body: JSON.stringify({ sessionId: "session-1" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith("https://example.com/design.png");
    expect(storageFromMock).toHaveBeenCalledWith("print-files");
    expect(uploadMock).toHaveBeenCalledWith(
      "session-1/print-file.png",
      expect.any(Blob),
      expect.objectContaining({
        contentType: "image/png",
        upsert: true,
      })
    );
    expect(getPublicUrlMock).toHaveBeenCalledWith("session-1/print-file.png");
    expect(update.update).toHaveBeenCalledWith({
      config: expect.objectContaining({
        print_file: {
          url: "https://storage.example.com/print-file.png",
          storage_path: "session-1/print-file.png",
        },
      }),
      updated_at: expect.any(String),
    });
    expect(json).toEqual({
      url: "https://storage.example.com/print-file.png",
      storage_path: "session-1/print-file.png",
    });
  });
});
