/**
 * 画面側からログインの API を呼ぶためのクライアント（better-auth）．
 * useSession でログイン中のユーザーを受け取り，signIn・signUp・signOut で操作する．
 */
import { createAuthClient } from "better-auth/react";

/** 同じオリジンの /api/auth を呼ぶので，URL の指定は要らない */
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;
