import Link from "next/link";
import { signUp } from "@/app/actions/auth";
import { Flash, type SearchParams } from "@/components/Flash";

export default function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-2 text-center text-2xl font-bold">家族を登録</h1>
      <p className="mb-6 text-center text-sm text-stone-500">親のアカウントを作り、あとから子どもを追加します</p>
      <Flash searchParams={searchParams} />
      <form action={signUp} className="card space-y-4">
        <div>
          <label className="label" htmlFor="family_name">家族の名前</label>
          <input className="input" id="family_name" name="family_name" placeholder="山田家" required />
        </div>
        <div>
          <label className="label" htmlFor="name">あなたの名前</label>
          <input className="input" id="name" name="name" placeholder="お母さん" required />
        </div>
        <div>
          <label className="label" htmlFor="email">メールアドレス</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">パスワード（8文字以上）</label>
          <input className="input" id="password" name="password" type="password" minLength={8} autoComplete="new-password" required />
        </div>
        <button className="btn w-full">登録する</button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link className="font-bold text-brand-dark underline" href="/login">ログインに戻る</Link>
      </p>
    </main>
  );
}
