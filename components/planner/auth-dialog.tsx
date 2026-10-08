"use client";

/**
 * ログインと新規登録のダイアログ．
 * メールアドレスとパスワードで better-auth の API を呼び，成功したら閉じる．
 * エラーは better-auth のエラーコードから日本語のメッセージにして出す．
 */

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signIn, signUp } from "@/lib/auth-client";

/** パスワードの最小文字数（lib/server/auth.ts の minPasswordLength と同じ） */
const MIN_PASSWORD = 8;

type Mode = "signin" | "signup";

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

/** better-auth のエラーを画面に出す日本語にする */
function toMessage(error: { code?: string; status?: number }): string {
	switch (error.code) {
		case "INVALID_EMAIL_OR_PASSWORD":
			return "メールアドレスかパスワードが違います．";
		case "USER_ALREADY_EXISTS":
		case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
			return "このメールアドレスはすでに登録されています．";
		case "INVALID_EMAIL":
			return "メールアドレスの形式が正しくありません．";
		case "PASSWORD_TOO_SHORT":
			return `パスワードは${MIN_PASSWORD}文字以上にしてください．`;
	}
	if (error.status === 429) {
		return "試行回数が多すぎます．しばらく待ってからお試しください．";
	}
	return "うまくいきませんでした．時間をおいてお試しください．";
}

/** ログイン・新規登録のタブを持つダイアログ */
export function AuthDialog({ open, onOpenChange }: Props) {
	const [mode, setMode] = useState<Mode>("signin");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [prevOpen, setPrevOpen] = useState(open);
	// 開くたびに「ログイン」タブに戻し，前回のエラーとパスワードを消す
	// （描画中に前回の状態と比べる React の推奨パターン）
	if (open !== prevOpen) {
		setPrevOpen(open);
		if (open) {
			setMode("signin");
			setError(null);
			setPassword("");
		}
	}

	/** 入力された内容でログインまたは登録する */
	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setPending(true);
		setError(null);
		const { error } =
			mode === "signin"
				? await signIn.email({ email, password })
				: await signUp.email({ name: name.trim(), email, password });
		setPending(false);
		if (error) {
			setError(toMessage(error));
			return;
		}
		toast.success(mode === "signin" ? "ログインしました" : "登録しました");
		setPassword("");
		onOpenChange(false);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="font-serif">アカウント</DialogTitle>
					<DialogDescription>
						ログインすると，ルートを端末をまたいで保存し，URL で共有できます．
					</DialogDescription>
				</DialogHeader>
				<Tabs
					value={mode}
					onValueChange={(v) => {
						setMode(v as Mode);
						setError(null);
					}}
				>
					<TabsList className="w-full">
						<TabsTrigger value="signin">ログイン</TabsTrigger>
						<TabsTrigger value="signup">新規登録</TabsTrigger>
					</TabsList>
				</Tabs>
				{/* 入力欄は2つのタブでほぼ共通なので，タブの外に1つだけ置き，mode で出し分ける */}
				<form onSubmit={submit} className="grid gap-3 pt-2">
					{mode === "signup" && (
						<div className="grid gap-1.5">
							<Label htmlFor="auth-name">名前</Label>
							<Input
								id="auth-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								maxLength={40}
								required
								autoComplete="nickname"
							/>
						</div>
					)}
					<div className="grid gap-1.5">
						<Label htmlFor="auth-email">メールアドレス</Label>
						<Input
							id="auth-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
							autoComplete="email"
						/>
					</div>
					<div className="grid gap-1.5">
						<Label htmlFor="auth-password">パスワード</Label>
						<Input
							id="auth-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							minLength={MIN_PASSWORD}
							required
							autoComplete={
								mode === "signin" ? "current-password" : "new-password"
							}
						/>
						{mode === "signup" && (
							<p className="text-muted-foreground text-xs">
								{MIN_PASSWORD}文字以上
							</p>
						)}
					</div>
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
					<Button type="submit" size="lg" disabled={pending}>
						{pending && <Loader2Icon className="animate-spin" />}
						{mode === "signin" ? "ログインする" : "登録する"}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}
