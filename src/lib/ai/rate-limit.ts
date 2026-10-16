export type AiRateLimitResult =
  | { allowed: true }
  | { allowed: false; status: 429 | 503; error: string };

export async function checkAiRateLimit(userId: string): Promise<AiRateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!redisUrl || !redisToken) {
    return { allowed: false, status: 503, error: "Tạm khóa AI vì chưa cấu hình Upstash giới hạn lượt gọi." };
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const { Ratelimit } = await import("@upstash/ratelimit");
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const userLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 d"), prefix: "floodtwin:ai:user" });
    const user = await userLimit.limit(userId);
    if (!user.success) return { allowed: false, status: 429, error: "Bạn đã đạt giới hạn hỗ trợ AI trong ngày. Bạn vẫn có thể dùng FLOODTWIN không cần AI." };

    const globalLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(200, "1 d"), prefix: "floodtwin:ai:global" });
    const global = await globalLimit.limit("all");
    if (!global.success) return { allowed: false, status: 429, error: "Hệ thống đã đạt giới hạn AI trong ngày." };
    return { allowed: true };
  } catch {
    return { allowed: false, status: 503, error: "Không xác thực được hạn mức AI. Vui lòng thử lại sau." };
  }
}
