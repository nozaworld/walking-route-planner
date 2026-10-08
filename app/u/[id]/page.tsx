/**
 * /u/[id]：利用者の公開ページ．名前と，その人が公開しているルートの一覧を出す．
 * 公開ルートが1件もなくてもページは出す（いない利用者は 404）．
 */

import { CompassIcon, PencilLineIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RouteCard } from "@/components/explore/route-card";
import { buttonVariants } from "@/components/ui/button";
import { getPublicProfile } from "@/lib/server/community-repo";
import { cn } from "@/lib/utils";

/** 利用者を読む．いなければ 404（メタデータと本体で結果を使い回す） */
const loadProfile = cache(async (id: string) => {
	const profile = await getPublicProfile(id);
	if (!profile) notFound();
	return profile;
});

/** ページのタイトルと説明 */
export async function generateMetadata(
	props: PageProps<"/u/[id]">,
): Promise<Metadata> {
	const { id } = await props.params;
	const profile = await loadProfile(id);
	return {
		title: `${profile.name} さんのルート | ルート疲労度プランナー`,
		description: `${profile.name} さんが公開している徒歩ルート（${profile.routes.length} 件）．`,
		robots: { index: false },
	};
}

/** ページ本体 */
export default async function UserPage(props: PageProps<"/u/[id]">) {
	const { id } = await props.params;
	const profile = await loadProfile(id);
	const totalKm =
		profile.routes.reduce((sum, r) => sum + r.stats.dist, 0) / 1000;

	return (
		<main className="mx-auto w-full max-w-2xl px-5 py-8">
			<header className="relative overflow-hidden rounded-2xl border bg-card">
				<div
					aria-hidden
					className="absolute inset-0 bg-seigaiha [mask-image:linear-gradient(to_left,black,transparent_75%)]"
				/>
				<div className="relative flex items-center gap-4 p-5">
					<span
						aria-hidden
						className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary font-bold font-serif text-2xl text-primary-foreground"
					>
						{Array.from(profile.name)[0] ?? "？"}
					</span>
					<div>
						<h1 className="font-bold font-serif text-2xl">
							{profile.name} さん
						</h1>
						<p className="text-muted-foreground text-xs tabular-nums">
							公開ルート {profile.routes.length} 件 ・ 合計 {totalKm.toFixed(1)}{" "}
							km ・ {new Date(profile.joinedAt).toLocaleDateString("ja-JP")}{" "}
							から
						</p>
					</div>
				</div>
			</header>

			{profile.routes.length === 0 ? (
				<p className="py-10 text-center text-muted-foreground text-sm">
					まだ公開しているルートはありません．
				</p>
			) : (
				<ul className="mt-5 grid gap-2 sm:grid-cols-2">
					{profile.routes.map((r) => (
						<RouteCard key={r.id} route={r} showAuthor={false} />
					))}
				</ul>
			)}

			<div className="mt-6 flex flex-wrap gap-2">
				<Link
					href="/explore"
					className={cn(buttonVariants({ variant: "outline" }), "flex-1")}
				>
					<CompassIcon />
					みんなのルート
				</Link>
				<Link href="/" className={cn(buttonVariants(), "flex-1")}>
					<PencilLineIcon />
					自分でルートを作る
				</Link>
			</div>
		</main>
	);
}
