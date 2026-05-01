import { afterEach, describe, expect, it, vi } from "vitest";

import { getJson, postJson, PrintfulApiError } from "../client";

describe("Printful client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PRINTFUL_API_KEY;
  });

  it("sends bearer auth and parses JSON responses", async () => {
    process.env.PRINTFUL_API_KEY = "pf_test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: { id: 123 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJson<{ result: { id: number } }>("/products/123");

    expect(result).toEqual({ result: { id: 123 } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.printful.com/products/123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer pf_test",
          Accept: "application/json",
        }),
      })
    );
  });

  it("posts JSON bodies with content type", async () => {
    process.env.PRINTFUL_API_KEY = "pf_test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await postJson("/orders", { recipient: "Ada" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.printful.com/orders",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ recipient: "Ada" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("throws status and response body for failed requests", async () => {
    process.env.PRINTFUL_API_KEY = "pf_test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 401, result: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })
      )
    );

    const error = await getJson("/store/products").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(PrintfulApiError);
    expect(error).toMatchObject({
      status: 401,
      body: { code: 401, result: "Unauthorized" },
    });
  });

  it("requires PRINTFUL_API_KEY", async () => {
    await expect(getJson("/store/products")).rejects.toThrow(
      "PRINTFUL_API_KEY ist nicht gesetzt"
    );
  });
});
