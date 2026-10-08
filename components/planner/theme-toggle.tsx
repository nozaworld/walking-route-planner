"use client";

/**
 * 明るいモードと暗いモードを切り替えるボタン．
 * 初期値は OS の設定に従い，押すと反対のモードに固定する．
 */

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/** 今のモードと反対のモードに切り替える */
export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			// テーマはサーバーでは分からないので，ラベルはモードによらず同じにする
			aria-label="明るい表示と暗い表示を切り替える"
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			{/* 表示前（テーマ未確定）でも形が崩れないよう，CSS で出し分ける */}
			<SunIcon className="hidden dark:block" />
			<MoonIcon className="dark:hidden" />
		</Button>
	);
}
