/**
 * 操作パネルの見出し．
 * 落款（はんこ）風のロゴ，アプリ名，ひとこと説明，表示モードの切り替えを，
 * 青海波の文様を薄く敷いた帯の上に並べる．
 */

import { ThemeToggle } from "./theme-toggle";

/** ロゴとアプリ名の帯 */
export function PanelHeader() {
	return (
		<header className="relative shrink-0 overflow-hidden border-b">
			{/* 文様は右へ行くほど消えるようにして，文字の邪魔をしない */}
			<div
				aria-hidden
				className="absolute inset-0 bg-seigaiha [mask-image:linear-gradient(to_left,black,transparent_75%)]"
			/>
			<div className="relative flex items-center gap-3 px-5 py-3 md:py-4">
				<span
					aria-hidden
					className="flex size-9 shrink-0 -rotate-6 md:size-10 items-center justify-center rounded-md bg-shu font-bold font-serif text-white text-xl shadow-sm"
				>
					歩
				</span>
				<div className="min-w-0 flex-1">
					<h1 className="font-bold font-serif text-lg leading-tight tracking-wider">
						ルート疲労度プランナー
					</h1>
					<p className="hidden text-muted-foreground text-xs md:block">
						坂道まで考えて，歩く道のりを見積もる
					</p>
				</div>
				<ThemeToggle />
			</div>
		</header>
	);
}
