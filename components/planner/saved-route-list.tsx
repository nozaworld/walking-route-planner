/**
 * 保存済みルートの一覧．
 * PC では地図の右，スマホでは地図の下に置く．項目を押すと地図に表示し，ゴミ箱で削除する．
 */

import { Trash2Icon } from "lucide-react";
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

/** 保存済みルートを一覧にする．なければその旨を出す */
export function SavedRouteList({
	routes,
	activeId,
	onSelect,
	onDelete,
}: Props) {
	return (
		<aside className="flex max-h-[35vh] min-h-0 flex-col border-t bg-card md:max-h-none md:w-75 md:border-t-0 md:border-l">
			<h2 className="border-b px-4 pt-3.5 pb-2 font-bold text-sm">
				保存したルート
			</h2>
			<div className="flex-1 overflow-y-auto p-2.5">
				{routes.length === 0 ? (
					<p className="px-1 py-1.5 text-muted-foreground text-xs">
						まだ保存されたルートはありません．
					</p>
				) : (
					<ul className="flex flex-col gap-2">
						{routes.map((r) => (
							<li
								key={r.id}
								className={cn(
									"relative rounded-md border text-xs leading-relaxed transition-colors hover:border-primary",
									r.id === activeId && "border-primary bg-muted",
								)}
							>
								<button
									type="button"
									onClick={() => onSelect(r)}
									className="w-full p-2.5 pr-10 text-left"
								>
									<div className="font-bold text-sm">{r.name}</div>
									<div>
										{(r.stats.dist / 1000).toFixed(2)} km ／ 獲得標高{" "}
										{Math.round(r.stats.gain)} m
									</div>
									<div>
										徒歩 {Math.round(r.stats.walkKcal)} kcal ／ 自転車{" "}
										{Math.round(r.stats.bikeKcal)} kcal
									</div>
								</button>
								{/* 削除ボタンは項目のボタンの中に入れられないので重ねて置く */}
								<Button
									variant="ghost"
									size="icon-sm"
									className="absolute top-1.5 right-1.5 text-destructive"
									aria-label={`${r.name}を削除`}
									onClick={() => onDelete(r.id)}
								>
									<Trash2Icon />
								</Button>
							</li>
						))}
					</ul>
				)}
			</div>
		</aside>
	);
}
