/**
 * /explore：「みんなのルート」．公開されたルートを地図で探すページ．
 * 中身はすべてブラウザ側（地図の表示範囲に応じて /api/explore を呼ぶ）．
 */
import type { Metadata } from "next";
import { Explore } from "@/components/explore/explore";

export const metadata: Metadata = {
	title: "みんなのルート | ルート疲労度プランナー",
	description: "みんなが公開した徒歩ルートを，距離や坂のきつさで探せます．",
};

/** ページ本体 */
export default function ExplorePage() {
	return <Explore />;
}
