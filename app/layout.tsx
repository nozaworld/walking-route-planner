/**
 * 全ページ共通のレイアウト．
 * 和文フォント（本文：Zen Kaku Gothic New，見出しと数字：しっぽり明朝），
 * ページのタイトル・説明，ダークモードの切り替え，トースト通知の置き場を定める．
 */
import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const gothic = Zen_Kaku_Gothic_New({
	variable: "--font-sans",
	weight: ["400", "500", "700"],
	subsets: ["latin"],
	display: "swap",
});

const mincho = Shippori_Mincho({
	variable: "--font-serif",
	weight: ["500", "700"],
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "ルート疲労度プランナー",
	description:
		"地図上で描いた徒歩ルートの距離・獲得標高・消費カロリーを，勾配を考慮して見積もります．",
};

/**
 * html と body の骨組み．
 * next-themes が html の class を書き換えるので，水和の不一致の警告は抑える．
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="ja"
			className={`${gothic.variable} ${mincho.variable} h-full antialiased`}
			suppressHydrationWarning
		>
			<body className="flex min-h-full flex-col">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					{children}
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
