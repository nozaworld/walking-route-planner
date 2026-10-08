/**
 * トップページ．プランナーの画面をそのまま表示する．
 */
import { Planner } from "@/components/planner/planner";

/** ページ本体（中身はすべてクライアント側の Planner） */
export default function Home() {
	return <Planner />;
}
