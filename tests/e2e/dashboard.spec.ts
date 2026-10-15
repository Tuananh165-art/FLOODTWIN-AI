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

test("requires an account before a real report can be submitted", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Gửi phản ánh" }).click();
  await page.getByLabel("Bạn quan sát điều gì?").fill("Tôi nghe nói tối qua có nước trên đường gần chợ.");
  await page.getByLabel(/Tôi đồng ý cho công khai/).check();
  await page.getByRole("button", { name: "Đăng nhập để gửi" }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
  await expect(page.getByText("Tài khoản do quản trị viên cấp.")).toBeVisible();
});

test("reports missing Supabase configuration as an explicit empty source", async ({ request }) => {
  const response = await request.get("/api/reports/public");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ reports: [], sourceStatus: "not_configured" });
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
