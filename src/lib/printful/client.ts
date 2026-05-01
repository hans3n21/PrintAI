const PRINTFUL_API_BASE_URL = "https://api.printful.com";

type JsonBody = Record<string, unknown> | unknown[] | string | number | boolean | null;

type RequestOptions = {
  method: "GET" | "POST";
  body?: JsonBody;
  /** Zusätzliche Header (OAuth/Store-ID-Kontext). */
  mergeHeaders?: Record<string, string>;
};

export class PrintfulApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "PrintfulApiError";
  }
}

function getApiKey() {
  const apiKey = process.env.PRINTFUL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PRINTFUL_API_KEY ist nicht gesetzt");
  }
  return apiKey;
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${PRINTFUL_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function buildPrintfulHeaders(mergeHeaders?: Record<string, string>): HeadersInit {
  const entries: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${getApiKey()}`,
  };
  const storeId = process.env.PRINTFUL_STORE_ID?.trim();
  if (storeId && !mergeHeaders?.["X-PF-Store-Id"] && !mergeHeaders?.["x-pf-store-id"]) {
    entries["X-PF-Store-Id"] = storeId;
  }
  if (mergeHeaders) {
    for (const [key, val] of Object.entries(mergeHeaders)) {
      if (val.trim() !== "") entries[key] = val;
    }
  }
  return entries;
}

async function requestJson<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = buildPrintfulHeaders(options.mergeHeaders);

  const init: RequestInit = {
    method: options.method,
    headers,
  };

  if (options.method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body ?? {});
  }

  const response = await fetch(buildUrl(path), init);
  const body = await parseResponseBody(response);

  if (!response.ok) {
    throw new PrintfulApiError(
      `Printful API request failed with status ${response.status}`,
      response.status,
      body
    );
  }

  return body as T;
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: "GET" });
}

export function postJson<T>(path: string, body: JsonBody, mergeHeaders?: Record<string, string>): Promise<T> {
  return requestJson<T>(path, { method: "POST", body, mergeHeaders });
}
