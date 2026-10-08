"use client";

/**
 * 共有ページのルートへの操作：いいね・自分用に保存・通報．
 * ログインしていない人が押したら，ログインのダイアログを開く．
 */

import { CopyPlusIcon, FlagIcon, HeartIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Props = {
	routeId: string;
	initialLiked: boolean;
	initialLikeCount: number;
	/** 自分のルートなら，いいね・保存・通報は出さない */
	isOwner: boolean;
	onLoginRequired: () => void;
};

/** API を呼び，失敗したら { error } のメッセージで例外を投げる */
async function call(url: string, method: string, body?: unknown) {
	const res = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return null;
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? "うまくいきませんでした．");
	return data;
}

/** いいね・自分用に保存・通報のボタン */
export function RouteActions({
	routeId,
	initialLiked,
	initialLikeCount,
	isOwner,
	onLoginRequired,
}: Props) {
	const { data: session } = useSession();
	const router = useRouter();
	const [liked, setLiked] = useState(initialLiked);
	const [likeCount, setLikeCount] = useState(initialLikeCount);
	const [busy, setBusy] = useState(false);

	/** ログインしていれば action を実行し，していなければログインを促す */
	async function requireLogin(action: () => Promise<void>) {
		if (!session) {
			onLoginRequired();
			return;
		}
		setBusy(true);
		try {
			await action();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "うまくいきませんでした．");
		} finally {
			setBusy(false);
		}
	}

	/** いいねを付け外しする */
	const toggleLike = () =>
		requireLogin(async () => {
			const r = await call(
				`/api/routes/${routeId}/like`,
				liked ? "DELETE" : "POST",
			);
			setLiked(r.liked);
			setLikeCount(r.likeCount);
		});

	/** 自分の保存済みに複製し，トップページで開けるようにする */
	const copy = () =>
		requireLogin(async () => {
			await call(`/api/routes/${routeId}/copy`, "POST");
			toast.success("自分の保存済みルートに追加しました", {
				action: { label: "開く", onClick: () => router.push("/") },
			});
		});

	/** 不適切なルートとして通報する */
	const reportRoute = () =>
		requireLogin(async () => {
			await call("/api/reports", "POST", {
				targetType: "route",
				targetId: routeId,
			});
			toast.success("通報しました．ご協力ありがとうございます");
		});

	if (isOwner) {
		return (
			<p className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<HeartIcon className="size-3.5" />
				{likeCount} 件のいいね
			</p>
		);
	}

	return (
		<div className="flex flex-wrap items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onClick={toggleLike}
				disabled={busy}
				aria-pressed={liked}
				className={cn(liked && "border-shu text-shu")}
			>
				<HeartIcon className={cn(liked && "fill-current")} />
				いいね {likeCount}
			</Button>
			<Button variant="outline" size="sm" onClick={copy} disabled={busy}>
				<CopyPlusIcon />
				自分用に保存
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onClick={reportRoute}
				disabled={busy}
				className="ml-auto text-muted-foreground"
			>
				<FlagIcon />
				通報
			</Button>
		</div>
	);
}
