"use client";

/**
 * 地図の上に浮かせる地名検索の欄．
 * Enter で /api/geocode に問い合わせ，候補を一覧にする．選ぶと親に伝える．
 * 利用回数の枠を節約するため，入力のたびではなく Enter（または検索ボタン）で検索する．
 */

import { Loader2Icon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LatLng } from "@/lib/geo";
import type { GeocodeResponse, Place } from "@/lib/geocode";
import { cn } from "@/lib/utils";

type Props = {
	/** 近い候補を優先するための基準点（地図の中心） */
	getCenter: () => LatLng | null;
	onSelect: (place: Place) => void;
	className?: string;
};

/** 検索の状態．results は候補を表示中（0件もありうる） */
type State =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "results"; places: Place[] }
	| { kind: "error"; message: string };

/** 検索欄と候補の一覧 */
export function PlaceSearch({ getCenter, onSelect, className }: Props) {
	const [query, setQuery] = useState("");
	const [state, setState] = useState<State>({ kind: "idle" });
	// キーボードで選んでいる候補の添字
	const [active, setActive] = useState(0);
	const listId = useId();
	const inputRef = useRef<HTMLInputElement>(null);

	/** 入力された語で検索する */
	async function search() {
		const q = query.trim();
		if (!q) return;
		setState({ kind: "loading" });
		const params = new URLSearchParams({ q });
		const center = getCenter();
		if (center) {
			params.set("lat", center.lat.toFixed(4));
			params.set("lng", center.lng.toFixed(4));
		}
		try {
			const res = await fetch(`/api/geocode?${params}`);
			const data = (await res.json()) as GeocodeResponse | { error: string };
			if ("error" in data) throw new Error(data.error);
			setActive(0);
			setState({ kind: "results", places: data.places });
		} catch (e) {
			setState({
				kind: "error",
				message:
					e instanceof Error && !(e instanceof TypeError)
						? e.message
						: "通信に失敗しました．",
			});
		}
	}

	/** 候補を選んで一覧を閉じる */
	function choose(place: Place) {
		onSelect(place);
		setQuery(place.name);
		setState({ kind: "idle" });
		inputRef.current?.blur();
	}

	/** 入力を消して一覧を閉じる */
	function clear() {
		setQuery("");
		setState({ kind: "idle" });
		inputRef.current?.focus();
	}

	/** ↑↓ で候補を移り，Enter で検索または決定，Esc で閉じる */
	function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		// 日本語の変換を確定する Enter では検索しない
		if (e.nativeEvent.isComposing) return;
		const places = state.kind === "results" ? state.places : [];
		if (e.key === "ArrowDown" && places.length > 0) {
			e.preventDefault();
			setActive((i) => (i + 1) % places.length);
		} else if (e.key === "ArrowUp" && places.length > 0) {
			e.preventDefault();
			setActive((i) => (i - 1 + places.length) % places.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (places.length > 0) choose(places[active]);
			else search();
		} else if (e.key === "Escape") {
			setState({ kind: "idle" });
		}
	}

	const open = state.kind === "results" || state.kind === "error";

	return (
		<div className={cn("relative", className)}>
			<div className="flex h-11 items-center gap-1 rounded-full border bg-card/95 pr-1 pl-4 shadow-md backdrop-blur focus-within:ring-2 focus-within:ring-ring/40">
				<SearchIcon className="size-4 shrink-0 text-muted-foreground" />
				<input
					ref={inputRef}
					type="search"
					role="combobox"
					aria-label="地名や駅名で探す"
					aria-expanded={open}
					aria-controls={listId}
					placeholder="地名・駅名・施設名で探す"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						// 入力し直したら古い候補は閉じる
						if (state.kind !== "idle") setState({ kind: "idle" });
					}}
					onKeyDown={handleKeyDown}
					className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
				/>
				{query && (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="入力を消す"
						onClick={clear}
					>
						<XIcon />
					</Button>
				)}
				<Button
					size="icon"
					className="rounded-full"
					aria-label="検索する"
					onClick={search}
					disabled={!query.trim() || state.kind === "loading"}
				>
					{state.kind === "loading" ? (
						<Loader2Icon className="animate-spin" />
					) : (
						<SearchIcon />
					)}
				</Button>
			</div>

			{open && (
				<div
					id={listId}
					className="absolute inset-x-0 top-full mt-2 overflow-hidden rounded-xl border bg-card shadow-lg"
				>
					{state.kind === "error" && (
						<p className="px-4 py-3 text-destructive text-sm">
							{state.message}
						</p>
					)}
					{state.kind === "results" && state.places.length === 0 && (
						<p className="px-4 py-3 text-muted-foreground text-sm">
							見つかりませんでした．別の言葉でお試しください．
						</p>
					)}
					{state.kind === "results" && state.places.length > 0 && (
						<ul aria-label="検索結果">
							{state.places.map((p, i) => (
								<li key={`${p.name}-${p.lat}-${p.lng}`}>
									<button
										type="button"
										onClick={() => choose(p)}
										onMouseEnter={() => setActive(i)}
										className={cn(
											"flex w-full items-center gap-3 px-4 py-2.5 text-left",
											i === active && "bg-muted",
										)}
									>
										<MapPinIcon className="size-4 shrink-0 text-shu" />
										<span className="min-w-0">
											<span className="block truncate font-bold text-sm">
												{p.name}
											</span>
											{p.area && (
												<span className="block truncate text-muted-foreground text-xs">
													{p.area}
												</span>
											)}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
