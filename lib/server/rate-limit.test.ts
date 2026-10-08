/**
 * lib/server/rate-limit.ts のユニットテスト（DB を使わない部分）．
 */
import { describe, expect, it, vi } from "vitest";

// DB への接続は使わないので，読み込みだけ差し替える
vi.mock("./db", () => ({ db: {} }));

const { clientIp, judge, usageKey, windowStart } = await import("./rate-limit");

describe("windowStart", () => {
	it("1分の窓は秒以下を切り捨てる", () => {
		const t = new Date("2026-10-09T12:34:56.789Z");
		expect(windowStart(t, "minute").toISOString()).toBe(
			"2026-10-09T12:34:00.000Z",
		);
	});

	it("1日の窓は UTC の0時に切り捨てる", () => {
		const t = new Date("2026-10-09T23:59:59Z");
		expect(windowStart(t, "day").toISOString()).toBe(
			"2026-10-09T00:00:00.000Z",
		);
	});
});

describe("clientIp", () => {
	it("x-forwarded-for の先頭を使う", () => {
		const req = new Request("http://x", {
			headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
		});
		expect(clientIp(req)).toBe("203.0.113.1");
	});

	it("ヘッダーがなければ unknown", () => {
		expect(clientIp(new Request("http://x"))).toBe("unknown");
	});
});

describe("usageKey", () => {
	it("IP ごとの上限には IP を，全体の上限には global を入れる", () => {
		expect(
			usageKey("plan", { scope: "ip", window: "minute", max: 1 }, "1.2.3.4"),
		).toBe("plan:ip:1.2.3.4:minute");
		expect(
			usageKey("plan", { scope: "global", window: "day", max: 1 }, "1.2.3.4"),
		).toBe("plan:global:day");
	});
});

describe("judge", () => {
	const minute = { scope: "ip", window: "minute", max: 10 } as const;
	const day = { scope: "global", window: "day", max: 100 } as const;
	const now = new Date("2026-10-09T12:00:30Z");

	it("上限ちょうどまでは通す", () => {
		expect(judge([minute, day], (l) => l.max, now)).toEqual({ ok: true });
	});

	it("1分の上限を超えたら，その分が終わるまでの秒数を返す", () => {
		const r = judge([minute, day], (l) => (l === minute ? 11 : 1), now);
		expect(r).toMatchObject({ ok: false, retryAfter: 30 });
	});

	it("複数超えたら，待ち時間がいちばん長いもの（1日）を返す", () => {
		const r = judge([minute, day], (l) => l.max + 1, now);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.retryAfter).toBe(12 * 3600 - 30);
			expect(r.message).toContain("アプリ全体");
		}
	});
});
