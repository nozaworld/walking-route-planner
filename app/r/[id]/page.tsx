/**
 * /r/[id]：ルートの共有ページ．
 * 共有中のルート（または持ち主が見ているとき）を DB から読み，地図・統計・断面図を読み取り専用で表示する．
 * 共有されていない・存在しないルートは 404 にする．
 * ページのタイトルと説明にルート名と距離を入れ，SNS などで共有したときに中身が分かるようにする．
 */

import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SharedRoute } from "@/components/shared/shared-route";
import { isRouteId } from "@/lib/server/api";
import { auth } from "@/lib/server/auth";
import { hasLiked } from "@/lib/server/community-repo";
import { getRouteForView } from "@/lib/server/routes-repo";

/**
 * 見ている人の権限でルートを読む．なければ 404 にする．
 * メタデータとページ本体の両方から呼ぶので，1回のリクエストの中では結果を使い回す．
 */
const loadRoute = cache(async (id: string) => {
	if (!isRouteId(id)) notFound();
	const session = await auth.api.getSession({ headers: await headers() });
	const viewerId = session?.user.id ?? null;
	const route = await getRouteForView(id, viewerId);
	if (!route) notFound();
	// 見ている人がいいね済みか（ボタンの初期状態に使う）
	const liked = viewerId ? await hasLiked(id, viewerId) : false;
	return { ...route, liked };
});

/** ページのタイトルと説明（共有したときのプレビューにも使われる） */
export async function generateMetadata(
	props: PageProps<"/r/[id]">,
): Promise<Metadata> {
	const { id } = await props.params;
	const route = await loadRoute(id);
	const description = `${route.authorName} さんのルート．${(route.stats.dist / 1000).toFixed(2)} km，獲得標高 ${Math.round(route.stats.gain)} m．`;
	return {
		title: `${route.name} | ルート疲労度プランナー`,
		description,
		openGraph: { title: route.name, description },
		// 共有ページは検索エンジンに載せない（URL を知っている人だけが見る想定）
		robots: { index: false },
	};
}

/** 共有ページ本体 */
export default async function SharedRoutePage(props: PageProps<"/r/[id]">) {
	const { id } = await props.params;
	const route = await loadRoute(id);
	return <SharedRoute route={route} />;
}
