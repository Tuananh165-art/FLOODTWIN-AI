import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "test-user" } } })) },
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class { constructor(_options: unknown) {} },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow(_count: number, _duration: string) { return {}; }
    constructor(_options: unknown) {}
    async limit(_key: string) { return { success: true }; }
  },
}));

let providerResponse: Response;
const providerFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => providerResponse);

function request() {
  return new Request("http://localhost/api/ai/analyze-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      description: "Tôi nghe người dân nói đoạn đường gần chợ có nước đọng tối qua.",
      consent: true,
    }),
  });
}

describe("POST /api/ai/analyze-report", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-provider-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-flash");
    providerResponse = new Response(JSON.stringify({
      model: "deepseek-flash",
      choices: [{
        finish_reason: "stop",
        message: { content: JSON.stringify({
          condition: "unclear",
          sourceType: "hearsay",
          certainty: "uncertain",
          reportedTime: "tối qua",
          placeMentioned: "gần chợ",
          needsLocationConfirmation: true,
          missingDetails: ["vị trí chính xác"],
          neutralSummary: "Người gửi nghe kể về nước đọng tối qua.",
          questions: [],
        }) },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    providerFetch.mockClear();
    vi.stubGlobal("fetch", providerFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables default reasoning so the provider token budget can produce the JSON extraction", async () => {
    const { POST } = await import("./route");
    const response = await POST(request());
    const result = await response.json();
    const [, init] = providerFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });
    expect(result.analysis).toMatchObject({ sourceType: "hearsay", certainty: "uncertain" });
    expect(result.requestId).toEqual(expect.any(String));
  });

  it("reports a truncated provider response with a traceable request ID", async () => {
    providerResponse = new Response(JSON.stringify({
      model: "deepseek-flash",
      choices: [{ finish_reason: "length", message: { content: "" } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const { POST } = await import("./route");
    const response = await POST(request());
    const result = await response.json();

    expect(response.status).toBe(502);
    expect(result.code).toBe("output_truncated");
    expect(result.requestId).toEqual(expect.any(String));
    expect(response.headers.get("x-request-id")).toBe(result.requestId);
  });
});
