"use client";

/**
 * ルート名を入力して保存するダイアログ．
 * 旧版のブラウザ標準の prompt() を置き換える．
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/** ルート名の最大文字数 */
const MAX_NAME_LENGTH = 50;

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** 開いたときに入力欄に入れておく名前 */
	defaultName: string;
	/** 前後の空白を除いた名前で呼ばれる */
	onSave: (name: string) => void;
};

/** 名前の入力欄と保存ボタンだけのダイアログ */
export function SaveRouteDialog({
	open,
	onOpenChange,
	defaultName,
	onSave,
}: Props) {
	const [name, setName] = useState(defaultName);
	const [prevOpen, setPrevOpen] = useState(open);
	// 開くたびに既定の名前へ戻す（描画中に前回の状態と比べる React の推奨パターン）
	if (open !== prevOpen) {
		setPrevOpen(open);
		if (open) setName(defaultName);
	}

	const trimmed = name.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<form
					className="grid gap-4"
					onSubmit={(e) => {
						e.preventDefault();
						if (trimmed) onSave(trimmed);
					}}
				>
					<DialogHeader>
						<DialogTitle>ルートを保存</DialogTitle>
					</DialogHeader>
					<Input
						aria-label="ルート名"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={MAX_NAME_LENGTH}
						autoFocus
					/>
					<DialogFooter>
						<Button type="submit" disabled={!trimmed}>
							保存する
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
