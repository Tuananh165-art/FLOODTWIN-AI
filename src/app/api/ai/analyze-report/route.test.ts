import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({ authenticated: true, userAllowed: true, globalAllowed: true }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: mockState.authenticated ? { id: "test-user" } : null } })) },
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class { constructor(_options: unknown) {} },
}));

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

function request(consent = true) {
  return new Request("http://localhost/api/ai/analyze-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      description: "Tôi nghe người dân nói đoạn đường gần chợ có nước đọng tối qua.",
      consent,
    }),
  });
}

describe("POST /api/ai/analyze-report", () => {
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
    expect(payload.messages[0].content).toContain("uncertain nếu sự kiện được kể gián tiếp");
    expect(payload.messages[0].content).toContain("Nếu chỉ nghe tiếng nước mà không biết đường có nước/ngập không, certainty là unknown");
    expect(payload.messages[0].content).toContain("water_on_road khi chỉ có vũng/lớp nước nông/chảy trên đường");
    expect(payload.messages[0].content).toContain("reportedTime phải trích ngắn gọn cụm thời gian gắn với từng mệnh đề sự kiện");
    expect(payload.messages[0].content).toContain("flooding khi có ngập/tràn phủ mặt đường hoặc nước cản trở qua lại");
    expect(payload.messages[0].content).toContain("dùng other kể cả khi không nói gì về đường hoặc câu phụ nói không thấy/nghe báo cáo ngập");
    expect(payload.messages[0].content).toContain("mực nước sông dâng ở bến đò nhưng không nêu đường ngập là other");
    expect(payload.messages[0].content).toContain("placeMentioned trích mọi cụm chỉ vị trí có trong lời kể");
    expect(payload.messages[0].content).toContain("sourceType xác định độc lập với condition và certainty");
    expect(payload.messages[0].content).toContain("Cụm 'thông tin trong nhóm' là hearsay kể cả khi không rõ nội dung");
    expect(payload.messages[0].content).toContain("Không mặc định firsthand chỉ vì người gửi viết câu bằng 'tôi'");
    expect(payload.messages[0].content).toContain("nếu nói 'chưa kiểm tra/chưa xác nhận' mà không nêu ai là nguồn, dùng unknown");
    expect(payload.messages[0].content).toContain("vì 'đang' chỉ tả người gửi");
    expect(payload.messages[0].content).toContain("với câu 'tôi đang đứng ở đường A, nước ngập' thì reportedTime phải để rỗng");
    expect(payload.messages[0].content).toContain("Giữ mốc thời gian kể cả khi các mệnh đề mâu thuẫn");
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

  it("rejects unauthenticated requests before calling the provider", async () => {
    mockState.authenticated = false;
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("requires consent before calling the provider", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(false));

    expect(response.status).toBe(400);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("stops at the per-user rate limit without calling the provider", async () => {
    mockState.userAllowed = false;
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("stops at the global rate limit without calling the provider", async () => {
    mockState.globalAllowed = false;
    const { POST } = await import("./route");
    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
