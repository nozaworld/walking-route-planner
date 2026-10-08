/**
 * 保存済みルートの一覧（パネルの「保存済み」タブの中身）．
 * 項目を押すと地図に表示し，ゴミ箱で削除する．
 */

import { BookmarkIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SavedRoute } from "@/lib/storage";
import { cn } from "@/lib/utils";

type Props = {
	routes: SavedRoute[];
	/** 地図に表示中のルートの id（強調表示に使う） */
	activeId: string | null;
	onSelect: (route: SavedRoute) => void;
	onDelete: (id: string) => void;
};

/** 保存した日付を「10月8日」の形にする */
function formatDate(ms: number): string {
	return new Date(ms).toLocaleDateString("ja-JP", {
		month: "long",
		day: "numeric",
	});
}

/** 保存済みルートを一覧にする．なければその旨を出す */
export function SavedRouteList({
	routes,
	activeId,
	onSelect,
	onDelete,
}: Props) {
	if (routes.length === 0) {
		return (
			<div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground text-xs">
				<BookmarkIcon className="size-6 opacity-50" />
				まだ保存されたルートはありません．
			</div>
		);
	}

	return (
		<ul className="flex flex-col gap-2">
			{routes.map((r) => (
				<li
					key={r.id}
					className={cn(
						"relative rounded-lg border bg-card transition-colors hover:border-primary/60",
						r.id === activeId && "border-primary ring-1 ring-primary/30",
					)}
				>
					<button
						type="button"
						onClick={() => onSelect(r)}
						className="w-full p-3 pr-11 text-left"
					>
						<div className="flex items-baseline justify-between gap-2">
							<span className="truncate font-bold font-serif">{r.name}</span>
							<span className="shrink-0 text-[11px] text-muted-foreground">
								{formatDate(r.savedAt)}
							</span>
						</div>
						<div className="mt-1 flex gap-3 text-muted-foreground text-xs tabular-nums">
							<span>{(r.stats.dist / 1000).toFixed(2)} km</span>
							<span>↑ {Math.round(r.stats.gain)} m</span>
							<span>{Math.round(r.stats.walkKcal)} kcal</span>
						</div>
					</button>
					{/* 削除ボタンは項目のボタンの中に入れられないので重ねて置く */}
					<Button
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
						aria-label={`${r.name}を削除`}
						onClick={() => onDelete(r.id)}
					>
						<Trash2Icon />
					</Button>
				</li>
			))}
		</ul>
	);
}
