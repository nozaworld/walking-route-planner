"use client";

/**
 * 保存ルートの読み書きをまとめたフック．
 * ログインしていなければブラウザ（localStorage），ログイン中ならクラウド（/api/routes）を使い，
 * 画面からはどちらでも同じ形（一覧・保存・削除）で扱えるようにする．
 * クラウドのときだけ，共有の切り替えとブラウザのルートの取り込みもできる．
 */

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { type CloudRoute, MAX_IMPORT, type RouteInput } from "@/lib/routes";
import { loadRoutes, type SavedRoute, saveRoutes } from "@/lib/storage";

/** 一覧に並べるルート．クラウドのものは shared を持つ */
export type ListedRoute = SavedRoute & { shared?: boolean };

/** どこに保存しているか．loading はログイン状態や一覧を確かめている最中 */
export type RouteSource = "loading" | "local" | "cloud";

/** API を呼び，失敗したら { error } のメッセージで例外を投げる */
async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (res.status === 204) return undefined as T;
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error ?? "保存に失敗しました．");
	return data as T;
}

/** 保存ルートの一覧と操作を返す */
export function useSavedRoutes() {
	const { data: session, isPending } = useSession();
	const userId = session?.user.id ?? null;
	const [source, setSource] = useState<RouteSource>("loading");
	const [routes, setRoutes] = useState<ListedRoute[]>([]);
	// ログイン中でも，ブラウザに残っているルート（取り込みの案内に使う）
	const [localRoutes, setLocalRoutes] = useState<SavedRoute[]>([]);

	// ログイン状態が分かったら，その保存先から一覧を読み込む
	useEffect(() => {
		if (isPending) return;
		const local = loadRoutes();
		setLocalRoutes(local);
		if (!userId) {
			setRoutes(local);
			setSource("local");
			return;
		}
		let cancelled = false;
		setSource("loading");
		callApi<{ routes: CloudRoute[] }>("/api/routes")
			.then((data) => {
				if (cancelled) return;
				setRoutes(data.routes);
				setSource("cloud");
			})
			.catch(() => {
				// クラウドが読めないときは，ブラウザのルートだけでも見せる
				if (cancelled) return;
				setRoutes(local);
				setSource("local");
			});
		return () => {
			cancelled = true;
		};
	}, [userId, isPending]);

	/** ブラウザの一覧を書き換える（ゲストのとき） */
	const writeLocal = useCallback((next: SavedRoute[]) => {
		setRoutes(next);
		setLocalRoutes(next);
		saveRoutes(next);
	}, []);

	/** ルートを保存し，保存したものを返す */
	const save = useCallback(
		async (input: RouteInput): Promise<ListedRoute> => {
			if (source === "cloud") {
				const { route } = await callApi<{ route: CloudRoute }>("/api/routes", {
					method: "POST",
					body: JSON.stringify(input),
				});
				setRoutes((prev) => [route, ...prev]);
				return route;
			}
			const route: SavedRoute = {
				id: crypto.randomUUID(),
				...input,
				savedAt: Date.now(),
			};
			writeLocal([route, ...routes]);
			return route;
		},
		[source, routes, writeLocal],
	);

	/** ルートを削除する */
	const remove = useCallback(
		async (id: string) => {
			if (source === "cloud") {
				await callApi(`/api/routes/${id}`, { method: "DELETE" });
				setRoutes((prev) => prev.filter((r) => r.id !== id));
				return;
			}
			writeLocal(routes.filter((r) => r.id !== id));
		},
		[source, routes, writeLocal],
	);

	/** 共有の有無を切り替える（クラウドのときだけ） */
	const setShared = useCallback(async (id: string, shared: boolean) => {
		const { route } = await callApi<{ route: CloudRoute }>(
			`/api/routes/${id}`,
			{ method: "PATCH", body: JSON.stringify({ shared }) },
		);
		setRoutes((prev) => prev.map((r) => (r.id === id ? route : r)));
	}, []);

	/**
	 * ブラウザのルートをアカウントに取り込み，取り込んだものはブラウザから消す．
	 * 一度に MAX_IMPORT 件までなので，それより多ければ残りはブラウザに残す（もう一度押せば続きを取り込む）．
	 */
	const importLocal = useCallback(async () => {
		const batch = localRoutes.slice(0, MAX_IMPORT);
		const rest = localRoutes.slice(MAX_IMPORT);
		const inputs: RouteInput[] = batch.map(
			({ name, coords, profile, stats }) => ({ name, coords, profile, stats }),
		);
		const { routes: imported } = await callApi<{ routes: CloudRoute[] }>(
			"/api/routes/import",
			{ method: "POST", body: JSON.stringify({ routes: inputs }) },
		);
		setRoutes((prev) =>
			[...imported, ...prev].sort((a, b) => b.savedAt - a.savedAt),
		);
		saveRoutes(rest);
		setLocalRoutes(rest);
		return imported.length;
	}, [localRoutes]);

	return {
		source,
		routes,
		/** ログイン中に，ブラウザに残っているルートの数 */
		localCount: source === "cloud" ? localRoutes.length : 0,
		save,
		remove,
		setShared,
		importLocal,
	};
}
