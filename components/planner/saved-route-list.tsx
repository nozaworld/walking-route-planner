"use client";

/**
 * 保存済みルートの一覧（パネルの「保存済み」タブの中身）．
 * 項目を押すと地図に表示し，ゴミ箱で削除する．
 * ゲストにはログインの案内を，ログイン中には共有の切り替え・リンクのコピーと，
 * ブラウザに残っているルートの取り込みボタンを出す．
 */

import {
	BookmarkIcon,
	CloudUploadIcon,
	GlobeIcon,
	LinkIcon,
	Loader2Icon,
	LockIcon,
	LogInIcon,
	Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ListedRoute, RouteSource } from "./use-saved-routes";

type Props = {
	source: RouteSource;
	routes: ListedRoute[];
	/** ログイン中に，ブラウザに残っているルートの数 */
	localCount: number;
	/** 地図に表示中のルートの id（強調表示に使う） */
	activeId: string | null;
	onSelect: (route: ListedRoute) => void;
	onDelete: (id: string) => void;
	onSetShared: (id: string, shared: boolean) => Promise<void>;
	/** 取り込んだ件数を返す */
	onImport: () => Promise<number>;
	onLoginClick: () => void;
};

/** 保存した日付を「10月8日」の形にする */
function formatDate(ms: number): string {
	return new Date(ms).toLocaleDateString("ja-JP", {
		month: "long",
		day: "numeric",
	});
}

/** ルートの共有ページの URL */
function shareUrl(id: string): string {
	return `${window.location.origin}/r/${id}`;
}

/** 案内と保存済みルートの一覧 */
export function SavedRouteList({
	source,
	routes,
	localCount,
	activeId,
	onSelect,
	onDelete,
	onSetShared,
	onImport,
	onLoginClick,
}: Props) {
	const [importing, setImporting] = useState(false);

	/** ブラウザのルートを取り込み，結果を知らせる */
	async function handleImport() {
		setImporting(true);
		try {
			const n = await onImport();
			toast.success(`${n}件のルートをアカウントに取り込みました`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "取り込めませんでした．");
		} finally {
			setImporting(false);
		}
	}

	if (source === "loading") {
		return (
			<div className="flex justify-center py-10 text-muted-foreground">
				<Loader2Icon className="size-5 animate-spin" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{source === "local" && (
				<div className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-xs leading-relaxed">
					<p className="flex-1 text-muted-foreground">
						いまはこのブラウザに保存しています．ログインすると，端末をまたいで保存し，URL
						で共有できます．
					</p>
					<Button size="sm" variant="outline" onClick={onLoginClick}>
						<LogInIcon />
						ログイン
					</Button>
				</div>
			)}

			{source === "cloud" && localCount > 0 && (
				<div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-xs">
					<p className="flex-1 text-muted-foreground">
						このブラウザに保存したルートが {localCount} 件あります．
					</p>
					<Button size="sm" onClick={handleImport} disabled={importing}>
						{importing ? (
							<Loader2Icon className="animate-spin" />
						) : (
							<CloudUploadIcon />
						)}
						取り込む
					</Button>
				</div>
			)}

			{routes.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground text-xs">
					<BookmarkIcon className="size-6 opacity-50" />
					まだ保存されたルートはありません．
				</div>
			) : (
				<ul className="flex flex-col gap-2">
					{routes.map((r) => (
						<RouteItem
							key={r.id}
							route={r}
							active={r.id === activeId}
							cloud={source === "cloud"}
							onSelect={onSelect}
							onDelete={onDelete}
							onSetShared={onSetShared}
						/>
					))}
				</ul>
			)}
		</div>
	);
}

/** 一覧の1項目．クラウドのときは共有の切り替えとリンクのコピーを並べる */
function RouteItem({
	route: r,
	active,
	cloud,
	onSelect,
	onDelete,
	onSetShared,
}: {
	route: ListedRoute;
	active: boolean;
	cloud: boolean;
	onSelect: (route: ListedRoute) => void;
	onDelete: (id: string) => void;
	onSetShared: (id: string, shared: boolean) => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);

	/** 共有の有無を切り替える */
	async function toggleShared() {
		setBusy(true);
		try {
			await onSetShared(r.id, !r.shared);
			toast.success(
				r.shared
					? "共有をやめました"
					: "共有しました．リンクを知っている人が見られます",
			);
		} catch (e) {
			toast.error(
				e instanceof Error ? e.message : "切り替えられませんでした．",
			);
		} finally {
			setBusy(false);
		}
	}

	/** 共有ページの URL をクリップボードにコピーする */
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl(r.id));
			toast.success("リンクをコピーしました");
		} catch {
			toast.error("コピーできませんでした．");
		}
	}

	return (
		<li
			className={cn(
				"relative rounded-lg border bg-card transition-colors hover:border-primary/60",
				active && "border-primary ring-1 ring-primary/30",
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

			{cloud && (
				<div className="flex items-center gap-1 border-t px-2 py-1.5">
					<Button
						variant="ghost"
						size="xs"
						onClick={toggleShared}
						disabled={busy}
						aria-pressed={r.shared}
						className={cn(r.shared && "text-matcha")}
					>
						{r.shared ? <GlobeIcon /> : <LockIcon />}
						{r.shared ? "共有中" : "非公開"}
					</Button>
					{r.shared && (
						<Button variant="ghost" size="xs" onClick={copyLink}>
							<LinkIcon />
							リンクをコピー
						</Button>
					)}
				</div>
			)}
		</li>
	);
}
