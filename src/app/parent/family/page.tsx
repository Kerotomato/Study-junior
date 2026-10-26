import { addChild, addParent, addSubject } from "@/app/actions/family";
import { Flash, type SearchParams } from "@/components/Flash";
import { requireParent } from "@/lib/auth";
import { familyMembers } from "@/lib/family";
import { familySubjects } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export default async function FamilyPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireParent();
  const supabase = await createClient();
  const [members, subjects] = await Promise.all([familyMembers(supabase, me.family_id), familySubjects(supabase, me.family_id)]);

  return (
    <>
      <Flash searchParams={searchParams} />
      <section className="card mb-4">
        <h2 className="h2">家族のメンバー</h2>
        <ul className="divide-y divide-stone-100 text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex justify-between py-2">
              <span>{m.name}</span>
              <span className="text-stone-500">{m.role === "parent" ? "親" : `子ども（ID：${m.login_id}）`}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card mb-4">
        <h2 className="h2">子どもを追加</h2>
        <form action={addChild} className="space-y-2">
          <input className="input" name="name" placeholder="名前（例：たろう）" aria-label="名前" required />
          <input
            className="input"
            name="login_id"
            placeholder="ログインID（半角英数字 3〜20文字）"
            aria-label="ログインID"
            pattern="[a-zA-Z0-9_\-]{3,20}"
            autoCapitalize="none"
            required
          />
          <input className="input" name="password" type="password" minLength={8} placeholder="パスワード（8文字以上）" aria-label="パスワード" autoComplete="new-password" required />
          <button className="btn w-full">追加する</button>
        </form>
        <p className="mt-2 text-xs text-stone-500">子どもはログイン画面で、このログインIDとパスワードを入力します。</p>
      </section>

      <section className="card mb-4">
        <h2 className="h2">親を追加</h2>
        <form action={addParent} className="space-y-2">
          <input className="input" name="name" placeholder="名前（例：お父さん）" aria-label="名前" required />
          <input className="input" name="email" type="email" placeholder="メールアドレス" aria-label="メールアドレス" required />
          <input className="input" name="password" type="password" minLength={8} placeholder="パスワード（8文字以上）" aria-label="パスワード" autoComplete="new-password" required />
          <button className="btn w-full">追加する</button>
        </form>
      </section>

      <section className="card">
        <h2 className="h2">科目</h2>
        <p className="mb-3 text-sm">{subjects.map((s) => s.name).join("・") || "まだありません"}</p>
        <form action={addSubject} className="flex gap-2">
          <input className="input" name="name" placeholder="科目名" aria-label="科目名" required />
          <button className="btn shrink-0">追加</button>
        </form>
      </section>
    </>
  );
}
