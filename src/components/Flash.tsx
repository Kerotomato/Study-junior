export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** サーバーアクションの結果（?ok= / ?error=）を表示する */
export async function Flash({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ok = typeof params.ok === "string" ? params.ok : null;
  const error = typeof params.error === "string" ? params.error : null;
  if (!ok && !error) return null;
  return (
    <p
      role="status"
      className={`mb-4 rounded-xl px-4 py-3 text-sm font-bold ${error ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
    >
      {error ?? ok}
    </p>
  );
}
