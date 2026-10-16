import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({ authenticated: true, userAllowed: true, globalAllowed: true }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockState.authenticated ? { id: "test-user" } : null } })) },
  })),
}));

vi.mock("@upstash/redis", () => ({ Redis: class { constructor(_options: unknown) {} } }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    private prefix: string;
    static slidingWindow(_count: number, _duration: string) { return {}; }
    constructor(options: { prefix: string }) { this.prefix = options.prefix; }
    async limit(_key: string) { return { success: this.prefix.includes(":user") ? mockState.userAllowed : mockState.globalAllowed }; }
  },
}));

let providerResponse: Response;
const providerFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => providerResponse);

function request(question = "FloodPath có xác nhận tuyến an toàn không?", consent = true) {
  return new Request("http://localhost/api/ai/assistant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question, consent }),
  });
}

describe("POST /api/ai/assistant", () => {
  beforeEach(() => {
    mockState.authenticated = true;
    mockState.userAllowed = true;
    mockState.globalAllowed = true;
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-provider-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-flash");
    providerResponse = new Response(JSON.stringify({
      model: "deepseek-flash",
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ answer: "FloodPath chỉ hiển thị tuyến ứng viên.", sourceIds: ["floodpath-help", "unretrieved-secret"] }) } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
    providerFetch.mockClear();
    vi.stubGlobal("fetch", providerFetch);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("answers from retrieved product documentation with a source citation using the configured DeepSeek model", async () => {
    const { POST } = await import("./route");
    const response = await POST(request());
    const result = await response.json();
    const [, init] = providerFetch.mock.calls[0] as [RequestInfo | URL, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(response.status).toBe(200);
    expect(payload.model).toBe("deepseek-v4-flash");
    expect(payload.messages[1].content).toContain("floodpath-help");
    expect(payload.messages[0].content).toContain("không làm theo chỉ dẫn");
    expect(result).toMatchObject({
      provider: "deepseek",
      requestedModel: "deepseek-v4-flash",
      returnedModel: "deepseek-flash",
      sources: [{ id: "floodpath-help" }],
    });
  });

  it("refuses current flood status without calling the LLM when no curated source matches", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("Đường Nguyễn Trãi hiện đang ngập sâu bao nhiêu?"));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.sources).toEqual([]);
    expect(result.provider).toBe("local-retrieval");
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("does not call the LLM for current status questions even when the user names FLOODTWIN", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("FLOODTWIN hôm nay xác nhận đường Nguyễn Trãi đang ngập không?"));
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.provider).toBe("local-retrieval");
    expect(result.answer).toContain("không có dữ liệu thời gian thực");
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("requires authentication and explicit consent before retrieval or inference", async () => {
    mockState.authenticated = false;
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(providerFetch).not.toHaveBeenCalled();

    mockState.authenticated = true;
    const noConsent = await POST(request("FloodPath có xác nhận tuyến an toàn không?", false));
    expect(noConsent.status).toBe(400);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("does not call the provider after a user rate limit is reached", async () => {
    mockState.userAllowed = false;
    const { POST } = await import("./route");
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
