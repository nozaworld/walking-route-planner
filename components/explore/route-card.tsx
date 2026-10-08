/**
 * 公開ルートの一覧の1件（カード）．
 * ルート名・作成者・距離・獲得標高・坂のきつさ・いいねとコメントの数を出す．
 * 「みんなのルート」と利用者のページで使う．
 */

import { HeartIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import {
	type PublicRouteSummary,
	STEEPNESS,
	steepnessOf,
} from "@/lib/community";
import { cn } from "@/lib/utils";

type Props = {
	route: PublicRouteSummary;
	selected?: boolean;
	/** 押したときの動き．なければカード全体が共有ページへのリンクになる */
	onSelect?: () => void;
	/** 作成者の名前を出すか（利用者のページでは出さない） */
	showAuthor?: boolean;
};

/** 公開ルート1件のカード */
export function RouteCard({
	route: r,
	selected = false,
	onSelect,
	showAuthor = true,
}: Props) {
	const steep = steepnessOf(r.stats);
	const body = (
		<>
			<div className="flex items-baseline justify-between gap-2">
				<span className="truncate font-bold font-serif">{r.name}</span>
				<span
					className={cn(
						"shrink-0 rounded-full border px-1.5 text-[10px]",
						steep === "steep" && "border-shu text-shu",
						steep === "moderate" &&
							"border-[var(--grade-moderate)] text-[var(--grade-moderate)]",
					)}
				>
					{STEEPNESS[steep].label}
				</span>
			</div>
			<div className="mt-1 flex flex-wrap gap-x-3 text-muted-foreground text-xs tabular-nums">
				<span>{(r.stats.dist / 1000).toFixed(2)} km</span>
				<span>↑ {Math.round(r.stats.gain)} m</span>
				<span className="flex items-center gap-0.5">
					<HeartIcon className="size-3" />
					{r.likeCount}
				</span>
				<span className="flex items-center gap-0.5">
					<MessageCircleIcon className="size-3" />
					{r.commentCount}
				</span>
			</div>
		</>
	);
	const className = cn(
		"block w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/60",
		selected && "border-primary ring-1 ring-primary/30",
	);

	return (
		<li>
			{onSelect ? (
				<div className={className}>
					<button type="button" onClick={onSelect} className="w-full text-left">
						{body}
					</button>
					<div className="mt-2 flex items-center justify-between text-xs">
						{showAuthor ? (
							<Link
								href={`/u/${r.authorId}`}
								className="text-muted-foreground hover:underline"
							>
								{r.authorName} さん
							</Link>
						) : (
							<span />
						)}
						<Link
							href={`/r/${r.id}`}
							className="font-bold text-primary hover:underline"
						>
							くわしく見る →
						</Link>
					</div>
				</div>
			) : (
				<Link href={`/r/${r.id}`} className={className}>
					{body}
				</Link>
			)}
		</li>
	);
}
