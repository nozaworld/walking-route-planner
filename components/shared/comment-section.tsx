"use client";

/**
 * 共有ページのコメント欄．
 * 一覧は誰でも見られ，書き込みはログインが必要．自分のコメントは消せ，他人のコメントは通報できる．
 */

import { FlagIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { MAX_COMMENT_LENGTH, type RouteComment } from "@/lib/community";

type Props = {
	routeId: string;
	onLoginRequired: () => void;
};

/** コメントの一覧と入力欄 */
export function CommentSection({ routeId, onLoginRequired }: Props) {
	const { data: session } = useSession();
	const [comments, setComments] = useState<RouteComment[] | null>(null);
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);

	/** コメントの一覧を読み直す */
	const load = useCallback(async () => {
		const res = await fetch(`/api/routes/${routeId}/comments`);
		const data = await res.json().catch(() => ({ comments: [] }));
		setComments(data.comments ?? []);
	}, [routeId]);

	// 最初と，ログイン状態が変わったとき（自分のコメントの判定が変わる）に読み込む
	// biome-ignore lint/correctness/useExhaustiveDependencies: session の変化で読み直したい
	useEffect(() => {
		load();
	}, [load, session?.user.id]);

	/** 書いたコメントを送る */
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!session) {
			onLoginRequired();
			return;
		}
		setSending(true);
		const res = await fetch(`/api/routes/${routeId}/comments`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body }),
		});
		setSending(false);
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			toast.error(data.error ?? "送れませんでした．");
			return;
		}
		setBody("");
		await load();
	}

	/** 自分のコメントを消す */
	async function remove(id: string) {
		const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
		if (!res.ok) toast.error("消せませんでした．");
		await load();
	}

	/** 他人のコメントを通報する */
	async function report(id: string) {
		if (!session) {
			onLoginRequired();
			return;
		}
		const res = await fetch("/api/reports", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ targetType: "comment", targetId: id }),
		});
		if (res.ok) toast.success("通報しました．ご協力ありがとうございます");
		else toast.error("通報できませんでした．");
	}

	return (
		<section aria-label="コメント" className="space-y-3">
			<h2 className="font-bold font-serif">コメント</h2>
			{comments === null ? (
				<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
			) : comments.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					まだコメントはありません．
				</p>
			) : (
				<ul className="space-y-2">
					{comments.map((c) => (
						<li
							key={c.id}
							className="rounded-lg border bg-background/60 p-2.5 text-sm"
						>
							<div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
								<a href={`/u/${c.authorId}`} className="hover:underline">
									{c.authorName}
								</a>
								<span className="flex items-center gap-1">
									{new Date(c.createdAt).toLocaleDateString("ja-JP")}
									{c.isMine ? (
										<Button
											variant="ghost"
											size="icon-xs"
											aria-label="コメントを消す"
											onClick={() => remove(c.id)}
										>
											<Trash2Icon />
										</Button>
									) : (
										<Button
											variant="ghost"
											size="icon-xs"
											aria-label="コメントを通報する"
											onClick={() => report(c.id)}
										>
											<FlagIcon />
										</Button>
									)}
								</span>
							</div>
							<p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
						</li>
					))}
				</ul>
			)}
			<form onSubmit={submit} className="space-y-2">
				<textarea
					aria-label="コメントを書く"
					value={body}
					onChange={(e) => setBody(e.target.value)}
					onFocus={() => !session && onLoginRequired()}
					maxLength={MAX_COMMENT_LENGTH}
					rows={2}
					placeholder={
						session ? "このルートの感想など" : "ログインするとコメントできます"
					}
					className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
				/>
				<Button type="submit" size="sm" disabled={!body.trim() || sending}>
					{sending && <Loader2Icon className="animate-spin" />}
					コメントする
				</Button>
			</form>
		</section>
	);
}
