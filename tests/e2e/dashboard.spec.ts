import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { configured: false, user: null } }));
  await page.route("**/api/reports/public", (route) => route.fulfill({ json: { reports: [], sourceStatus: "available" } }));
  await page.route("**/api/weather?**", (route) => route.fulfill({ json: {
    source: "open-meteo", mode: "forecast", retrievedAt: "2026-10-15T03:00:00.000Z",
    resolution: "Dự báo tại điểm lưới, không phải đo tại đường.", location: { lat: 10.956, lon: 106.838 }, timezone: "Asia/Ho_Chi_Minh",
    current: { time: "2026-10-15T10:00", precipitationMm: 0, temperatureC: 30, windSpeedKmh: 8, label: "Ước tính mô hình" },
    hours: Array.from({ length: 48 }, (_, index) => ({ time: new Date(Date.UTC(2026, 9, 15, index)).toISOString().slice(0, 16), precipitationMm: index === 4 ? 12.4 : 0.2 })),
    assessment: { level: "low_signal", reasons: ["Dự báo mưa dưới ngưỡng chú ý thử nghiệm."], ruleVersion: "rain-reference-v1" },
  } }));
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==", "base64") }));
});

test("shows source-backed weather, safety context and isolated FloodLab scenario", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Thông tin hỗ trợ tham khảo.")).toBeVisible();
  await expect(page.getByText("Dự báo Open-Meteo")).toBeVisible();
  await expect(page.locator(".metric-grid .metric-main").nth(1).locator("b")).toHaveText("0.2 mm");
  await expect(page.locator(".rain-column")).toHaveCount(48);
  await expect(page.locator(".rain-accumulations")).toContainText("17.0 mm");
  await page.getByRole("button", { name: /FloodLab/ }).click();
  await expect(page.getByText(/FloodLab đang chạy/)).toBeVisible();
  await expect(page.getByText(/MÔ PHỎNG · KHÔNG DÙNG ĐỂ DI CHUYỂN/)).toBeVisible();
  await expect(page.locator(".lab-scenario")).toHaveCount(8);
  await page.getByRole("button", { name: /7\. Đóng đường/ }).click();
  await expect(page.getByText(/Đóng đường chỉ là giả lập/)).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Xuất JSON" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("floodlab-road_closure.json");
  await page.locator(".lab-controls").getByRole("button", { name: "Đặt lại" }).click();
  await expect(page.getByText(/FloodLab đang chạy/)).toHaveCount(0);
});

test("hydrates the dashboard without a React hydration mismatch in a clean browser", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("does not keep a service worker active in the Next.js development server", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(async () => ("serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0))).toBe(0);
});

test("requires an account before a real report can be submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gửi phản ánh" }).click();
  await page.getByLabel("Bạn quan sát điều gì?").fill("Tôi nghe nói tối qua có nước trên đường gần chợ.");
  await page.getByLabel(/Tôi đồng ý cho công khai/).check();
  await page.getByRole("button", { name: "Đăng nhập để gửi" }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByText(/Tài khoản mới tự nhận quyền thành viên/)).toBeVisible();
  await expect(page.getByLabel("Tên đăng nhập hoặc email")).toBeVisible();
});

test("offers username registration and handles email confirmation", async ({ page }) => {
  let registration: Record<string, unknown> | null = null;
  await page.route("**/api/auth/session", async (route) => {
    if (route.request().method() === "POST") {
      registration = route.request().postDataJSON();
      await route.fulfill({ status: 201, json: { created: true, confirmationRequired: true, message: "Đã tạo tài khoản. Hãy xác nhận email." } });
      return;
    }
    await route.fulfill({ json: { configured: true, user: null } });
  });
  await page.goto("/");
  await page.locator(".topbar-actions").getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("button", { name: "Chưa có tài khoản? Đăng ký" }).click();
  await page.getByLabel("Tên đăng nhập", { exact: true }).fill("ngap_demo");
  await page.getByLabel("Email", { exact: true }).fill("demo@example.test");
  await page.getByLabel(/Mật khẩu · ít nhất 10 ký tự/).fill("test-password-123");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).last().click();
  await expect(page.getByRole("status")).toContainText("Hãy xác nhận email");
  expect(registration).toMatchObject({ action: "register", username: "ngap_demo", email: "demo@example.test" });
});

test("reports missing Supabase configuration as an explicit empty source", async ({ request }) => {
  const response = await request.get("/api/reports/public");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.reports).toEqual([]);
  if (body.sourceStatus === "available") test.skip(true, "Local .env has Supabase configured; missing-provider behavior is covered by source/unit checks.");
  expect(body.sourceStatus).toBe("not_configured");
});

test("opens distinct workspaces, shows module guidance and explains notifications", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "FloodPath", exact: true }).click();
  await expect(page.locator(".path-workspace")).toBeVisible();
  await expect(page.locator(".forecast-panel")).toHaveCount(0);
  await expect(page.getByText("Cách dùng FloodPath")).toBeVisible();
  await page.getByRole("button", { name: "FloodPulse", exact: true }).click();
  await expect(page.locator(".forecast-panel")).toBeVisible();
  await expect(page.locator(".route-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Báo cáo hiện trường" }).click();
  await expect(page.locator(".reports-workspace")).toBeVisible();
  await expect(page.locator(".map-section")).toHaveCount(0);
  await page.getByRole("button", { name: "Thông báo" }).click();
  await expect(page.getByText("Thông báo chưa được kết nối")).toBeVisible();
});

test("answers product help questions with cited local sources and explicit DeepSeek consent", async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { configured: true, user: { email: "member@example.test", username: "member", role: "member" } } }));
  await page.route("**/api/ai/assistant", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: {
      answer: "FloodPath hiển thị tuyến ứng viên; hệ thống không xác nhận tuyến an toàn.",
      sources: [{ id: "floodpath-help", title: "FloodPath và tuyến ứng viên", source: "Hướng dẫn giao diện · FloodPath", excerpt: "Tuyến hiển thị không được xác nhận an toàn." }],
      provider: "deepseek", requestedModel: "deepseek-v4-flash", returnedModel: "deepseek-flash",
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Phương pháp & trợ giúp" }).click();
  await expect(page.getByRole("heading", { name: "Trợ lý hướng dẫn sản phẩm" })).toBeVisible();
  await page.getByRole("textbox", { name: "Câu hỏi" }).fill("FloodPath có xác nhận tuyến an toàn không?");
  const ask = page.getByRole("button", { name: "Hỏi trợ lý" });
  await expect(ask).toBeDisabled();
  await page.getByLabel(/Tôi đồng ý gửi câu hỏi/).check();
  await ask.click();
  await expect(page.locator(".help-chat-answer")).toContainText("không xác nhận tuyến an toàn");
  await expect(page.locator(".help-chat-sources")).toContainText("FloodPath và tuyến ứng viên");
  await expect(page.locator(".help-chat-answer-title")).toContainText("deepseek-flash");
  expect(payload).toMatchObject({ question: "FloodPath có xác nhận tuyến an toàn không?", consent: true });
});

test("selects a city-wide workspace and keeps browser simulation out of the report form", async ({ page }) => {
  const weatherRequests: string[] = [];
  page.on("request", (request) => { if (request.url().includes("/api/weather?")) weatherRequests.push(request.url()); });
  await page.goto("/");
  await page.getByLabel("KHU VỰC", { exact: true }).selectOption("ho_chi_minh");
  await expect.poll(() => weatherRequests.some((url) => url.includes("lat=10.7769") && url.includes("lon=106.7009"))).toBe(true);
  await page.getByRole("button", { name: "Gửi phản ánh" }).click();
  await page.getByLabel("Bạn quan sát điều gì?").fill("Tình huống giả lập có nước đọng gần ngã tư.");
  await expect(page.getByLabel(/Chỉ tạo mô phỏng trong trình duyệt/)).toHaveCount(0);
  await expect(page.getByLabel(/Tôi đồng ý gửi phần mô tả/)).toBeEnabled();
  await expect(page.getByText(/DeepSeek/i)).toHaveCount(0);
});

test("submits opted-in report text to AI and renders the normalized suggestion", async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/ai/analyze-report", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: {
      analysis: {
        condition: "unclear", sourceType: "hearsay", certainty: "uncertain",
        reportedTime: "tối qua", placeMentioned: "gần chợ", needsLocationConfirmation: true,
        missingDetails: ["vị trí chính xác"], neutralSummary: "Người gửi nghe kể về nước đọng tối qua.",
        questions: ["Bạn có thể chọn vị trí trên bản đồ không?"],
      },
      requestId: "ai-success-test",
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Gửi phản ánh", exact: true }).click();
  await page.getByLabel("Bạn quan sát điều gì?").fill("Tôi nghe người dân nói đoạn đường gần chợ có nước đọng tối qua.");
  await page.locator(".consent-row").first().locator("input").check();
  await page.getByRole("button", { name: "Phân tích mô tả bằng AI" }).click();
  await expect(page.locator(".report-body .inline-notice")).toContainText("Người gửi nghe kể về nước đọng tối qua.");
  await expect(page.locator(".report-body .inline-notice")).toContainText("Lời kể gián tiếp");
  const missingDetails = page.locator(".report-body .inline-notice dt").filter({ hasText: "Cần bổ sung" }).locator("xpath=following-sibling::dd[1]");
  await expect(missingDetails).toHaveText("vị trí chính xác");
  expect(payload).toMatchObject({
    description: "Tôi nghe người dân nói đoạn đường gần chợ có nước đọng tối qua.",
    consent: true,
  });
});

test("shows the AI request ID when report analysis fails", async ({ page }) => {
  await page.route("**/api/ai/analyze-report", (route) => route.fulfill({
    status: 502,
    json: { error: "AI chưa trả được kết quả.", code: "output_truncated", requestId: "ai-failure-test" },
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Gửi phản ánh", exact: true }).click();
  await page.getByLabel("Bạn quan sát điều gì?").fill("Tôi nghe người dân nói đoạn đường gần chợ có nước đọng tối qua.");
  await page.locator(".consent-row").first().locator("input").check();
  await page.getByRole("button", { name: "Phân tích mô tả bằng AI" }).click();
  await expect(page.locator(".report-body .error-notice")).toContainText("Mã yêu cầu: ai-failure-test");
  await expect(page.locator(".report-body .error-notice")).toContainText("AI là tùy chọn");
});

test("clips a long account email inside the sidebar without layout overflow", async ({ page }) => {
  const email = "very.long.account.name.for.floodtwin@example.test";
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { configured: true, user: { email, username: null, role: "member" } } }));
  await page.goto("/");
  const accountName = page.locator(".sidebar-profile b");
  await expect(accountName).toHaveText(email);
  const dimensions = await accountName.evaluate((element) => {
    const row = element.closest<HTMLElement>(".sidebar-profile");
    const style = getComputedStyle(element);
    return {
      nameClient: element.clientWidth,
      nameScroll: element.scrollWidth,
      rowClient: row?.clientWidth ?? 0,
      rowScroll: row?.scrollWidth ?? 0,
      overflow: style.overflowX,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  });
  expect(dimensions.nameScroll).toBeGreaterThan(dimensions.nameClient);
  expect(dimensions.rowScroll).toBeLessThanOrEqual(dimensions.rowClient);
  expect(dimensions).toMatchObject({ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
});

test("selects an ORS vehicle profile and displays the returned baseline route", async ({ page }) => {
  let payload: Record<string, unknown> | null = null;
  await page.route("**/api/routes", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({ json: {
      provider: "openrouteservice", profile: "driving-car",
      routes: [{ id: "route-1", label: "Tuyến cơ sở", geometry: { type: "LineString", coordinates: [[106.838, 10.956], [106.9, 10.93]] }, distanceMeters: 6800, durationSeconds: 900, nearbyReviewedReportCount: 1, evidenceRadiusMeters: 50 }],
      evidenceCoverage: "published_reports_only",
      limitations: ["Không có báo cáo gần tuyến không đồng nghĩa tuyến an toàn."],
    } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "FloodPath", exact: true }).click();
  await page.getByLabel("Phương tiện").selectOption("car");
  await page.getByRole("button", { name: "Tìm và đối chiếu tuyến" }).click();
  await expect(page.getByText("6.8 km · 15 phút provider")).toBeVisible();
  await expect(page.getByText(/không đồng nghĩa tuyến an toàn/)).toBeVisible();
  expect(payload).toMatchObject({ mode: "car" });
});

test("offers sanitized public report exports", async ({ page }) => {
  await page.route("**/api/reports/public/export?format=csv", (route) => route.fulfill({
    status: 200,
    contentType: "text/csv; charset=utf-8",
    headers: { "content-disposition": 'attachment; filename="floodtwin-public-reports.csv"' },
    body: "\uFEFFtom_tat_cong_khai\r\n",
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Báo cáo hiện trường" }).click();
  await expect(page.getByRole("link", { name: /CSV công khai/ })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: /CSV công khai/ }).click();
  expect((await downloadPromise).suggestedFilename()).toBe("floodtwin-public-reports.csv");
});

test("keeps the dashboard usable at a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xem vị trí của tôi" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 2)
      .slice(0, 8)
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}:${Math.round(element.getBoundingClientRect().right)}`),
  }));
  expect(dimensions.page, dimensions.overflowing.join(", ")).toBeLessThanOrEqual(dimensions.viewport);
});
