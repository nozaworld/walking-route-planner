/**
 * 全ページ共通のレイアウト．フォント，ページのタイトル・説明，トースト通知の置き場を定める．
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ルート疲労度プランナー",
	description:
		"地図上で描いた徒歩ルートの距離・獲得標高・消費カロリーを，勾配を考慮して見積もります．",
};

/** html と body の骨組み．保存時などの通知に使う Toaster もここに置く */
export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="ja"
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				{children}
				<Toaster />
			</body>
		</html>
	);
}
