import Link from "next/link";
import { signIn } from "@/app/actions/auth";
import { Flash, type SearchParams } from "@/components/Flash";

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-6 text-center text-2xl font-bold">勉強ごほうび</h1>
      <Flash searchParams={searchParams} />
      <form action={signIn} className="card space-y-4">
        <div>
          <label className="label" htmlFor="id">
            ログインID（親はメールアドレス）
          </label>
          <input className="input" id="id" name="id" autoComplete="username" autoCapitalize="none" required />
        </div>
        <div>
          <label className="label" htmlFor="password">
            パスワード
          </label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">ログイン</button>
      </form>
      <p className="mt-6 text-center text-sm">
        はじめての方（親）は <Link className="font-bold text-brand-dark underline" href="/signup">家族を登録</Link>
      </p>
    </main>
  );
}
