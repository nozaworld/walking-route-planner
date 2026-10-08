/**
 * API の利用回数の制限．
 * ORS の無料枠（経路 2,000回/日，地名検索 1,000回/日）を，連打や自動アクセスで使い切られないようにする．
 * IP ごとの「1分あたり」「1日あたり」と，アプリ全体の「1日あたり」を api_usage テーブルで数える．
 * DB に一時的につながらないときは制限をかけずに通す（アプリが使えなくなるのを避ける）．
 */

import { lt, sql } from "drizzle-orm";
import { apiUsage } from "@/db/schema";
import { db } from "./db";

/** 数える時間の窓 */
export type Window = "minute" | "day";

/** 1つの上限．scope が ip なら IP ごと，global ならアプリ全体で数える */
export type Limit = { scope: "ip" | "global"; window: Window; max: number };

/** 制限をかける API と，その上限（docs/db-phase.md の表と同じ） */
export const LIMITS = {
	plan: [
		{ scope: "ip", window: "minute", max: 10 },
		{ scope: "ip", window: "day", max: 150 },
		{ scope: "global", window: "day", max: 1500 },
	],
	geocode: [
		{ scope: "ip", window: "minute", max: 20 },
		{ scope: "ip", window: "day", max: 200 },
		{ scope: "global", window: "day", max: 450 },
	],
	// いいね・コメント・通報・複製（連投や荒らしを防ぐ．外部 API は使わない）
	write: [
		{ scope: "ip", window: "minute", max: 30 },
		{ scope: "ip", window: "day", max: 500 },
	],
} as const satisfies Record<string, readonly Limit[]>;

export type LimitedApi = keyof typeof LIMITS;

/** 窓の長さ [ミリ秒] */
const WINDOW_MS: Record<Window, number> = {
	minute: 60_000,
	day: 86_400_000,
};

/** 古い記録を消す処理を，何回に1回行うか */
const CLEANUP_EVERY = 100;

/** 時刻を窓の始まりに切り捨てる（1日の窓は UTC の0時で区切る） */
export function windowStart(now: Date, window: Window): Date {
	const ms = WINDOW_MS[window];
	return new Date(Math.floor(now.getTime() / ms) * ms);
}

/**
 * リクエストを送ってきた IP を取り出す．
 * Vercel は x-forwarded-for の先頭に本来の IP を入れる．分からなければ unknown．
 */
export function clientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	const first = forwarded?.split(",")[0]?.trim();
	return first || request.headers.get("x-real-ip") || "unknown";
}

/** 上限ごとの記録のキー（例：plan:ip:203.0.113.1:minute，plan:global:day） */
export function usageKey(api: string, limit: Limit, ip: string): string {
	const who = limit.scope === "ip" ? `ip:${ip}` : "global";
	return `${api}:${who}:${limit.window}`;
}

/** 制限の結果．超えていれば，何秒後に使えるようになるかとメッセージを持つ */
export type RateLimitResult =
	| { ok: true }
	| { ok: false; retryAfter: number; message: string };

/** 超えた上限に応じて，画面に出すメッセージを選ぶ */
function messageFor(limit: Limit): string {
	if (limit.scope === "global") {
		return "本日はアプリ全体の利用回数の上限に達しました．明日またお試しください．";
	}
	return limit.window === "minute"
		? "短い時間に何度も使われています．1分ほど待ってからお試しください．"
		: "本日の利用回数の上限に達しました．明日またお試しください．";
}

/**
 * 回数を1つ増やし，上限を超えていないかを確かめる．
 * 上限ごとの記録を1回の SQL でまとめて増やし，増やしたあとの回数で判断する．
 */
export async function checkRateLimit(
	api: LimitedApi,
	request: Request,
	now = new Date(),
): Promise<RateLimitResult> {
	const limits: readonly Limit[] = LIMITS[api];
	const ip = clientIp(request);
	try {
		const rows = await db
			.insert(apiUsage)
			.values(
				limits.map((limit) => ({
					key: usageKey(api, limit, ip),
					windowStart: windowStart(now, limit.window),
					count: 1,
				})),
			)
			.onConflictDoUpdate({
				target: [apiUsage.key, apiUsage.windowStart],
				set: { count: sql`${apiUsage.count} + 1` },
			})
			.returning({ key: apiUsage.key, count: apiUsage.count });

		if (Math.random() * CLEANUP_EVERY < 1) void cleanup(now);

		const counts = new Map(rows.map((r) => [r.key, r.count]));
		return judge(limits, (limit) => counts.get(usageKey(api, limit, ip)), now);
	} catch (e) {
		console.error(
			"利用回数を数えられませんでした（制限をかけずに通します）",
			e,
		);
		return { ok: true };
	}
}

/**
 * 上限ごとの回数から，超えているかどうかを判断する．
 * 超えた上限が複数あるときは，待ち時間がいちばん長いものを返す．
 */
export function judge(
	limits: readonly Limit[],
	countOf: (limit: Limit) => number | undefined,
	now: Date,
): RateLimitResult {
	let worst: { retryAfter: number; message: string } | null = null;
	for (const limit of limits) {
		if ((countOf(limit) ?? 0) <= limit.max) continue;
		const end =
			windowStart(now, limit.window).getTime() + WINDOW_MS[limit.window];
		const retryAfter = Math.ceil((end - now.getTime()) / 1000);
		if (!worst || retryAfter > worst.retryAfter) {
			worst = { retryAfter, message: messageFor(limit) };
		}
	}
	return worst ? { ok: false, ...worst } : { ok: true };
}

/** 2日より前の記録を消す（失敗しても動作には影響しないのでログだけ残す） */
async function cleanup(now: Date) {
	try {
		await db
			.delete(apiUsage)
			.where(
				lt(apiUsage.windowStart, new Date(now.getTime() - 2 * WINDOW_MS.day)),
			);
	} catch (e) {
		console.error("古い利用回数の記録を消せませんでした", e);
	}
}

/** 上限を超えたときの 429 応答（Retry-After で待ち時間を知らせる） */
export function tooManyRequests(result: {
	retryAfter: number;
	message: string;
}) {
	return Response.json(
		{ error: result.message },
		{ status: 429, headers: { "Retry-After": String(result.retryAfter) } },
	);
}
