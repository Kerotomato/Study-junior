/** 画面を読み込んでいる間の仮表示（カードの形だけ先に出して、すぐ画面が切り替わったように見せる） */
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="読み込み中">
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-20 animate-pulse bg-stone-100" />
        ))}
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-1/3 animate-pulse rounded bg-stone-200" />
        <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-stone-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
      </div>
      <div className="card h-40 animate-pulse bg-stone-100" />
    </div>
  );
}
