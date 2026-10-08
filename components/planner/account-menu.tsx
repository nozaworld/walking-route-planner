"use client";

/**
 * パネルの見出しの右上に置く，アカウントのボタン．
 * ログインしていなければログインのアイコンボタン，ログイン中なら名前の頭文字の丸いボタンを出し，
 * 押すと名前・メールアドレス・ログアウトのメニューを開く．
 */

import { LogInIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";

/**
 * ログイン状態に応じたボタンとメニュー．
 * ログインのダイアログは画面全体（Planner）が持ち，保存済みタブの案内からも開けるようにする．
 */
export function AccountMenu({ onLoginClick }: { onLoginClick: () => void }) {
	const { data: session, isPending } = useSession();
	return (
		<AccountButton
			session={session}
			isPending={isPending}
			onLoginClick={onLoginClick}
		/>
	);
}

/** ログインしていなければログインのボタン，ログイン中ならアカウントのメニュー */
function AccountButton({
	session,
	isPending,
	onLoginClick,
}: {
	session: ReturnType<typeof useSession>["data"];
	isPending: boolean;
	onLoginClick: () => void;
}) {
	// セッションを確かめている間は，ボタンの場所だけ確保して表示が跳ねないようにする
	if (isPending) return <div className="size-7" />;

	if (!session) {
		return (
			// 見出しの幅が狭いのでアイコンだけにする（保存済みタブでも案内する）
			<Button
				variant="ghost"
				size="icon-sm"
				aria-label="ログイン"
				title="ログイン"
				onClick={onLoginClick}
			>
				<LogInIcon />
			</Button>
		);
	}

	const { name, email } = session.user;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						size="icon-sm"
						className="rounded-full font-bold font-serif"
						aria-label={`${name}のアカウント`}
					/>
				}
			>
				{/* 名前の先頭1文字を丸の中に出す */}
				{Array.from(name)[0] ?? "？"}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuGroup>
					<DropdownMenuLabel>
						<div className="font-bold text-foreground">{name}</div>
						<div className="truncate font-normal text-xs">{email}</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={async () => {
						await signOut();
						toast.success("ログアウトしました");
					}}
				>
					<LogOutIcon />
					ログアウト
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
