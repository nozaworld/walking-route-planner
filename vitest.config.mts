/**
 * Vitest の設定．
 * ユニットテストは *.test.ts(x) を対象にし，Playwright の E2E（tests/）は含めない．
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	resolve: {
		// tsconfig と同じく @/ をリポジトリのルートに向ける
		alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
	},
	test: {
		include: ["**/*.test.{ts,tsx}"],
		exclude: ["node_modules/**", ".next/**", "tests/**"],
	},
});
