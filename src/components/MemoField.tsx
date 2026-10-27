export function MemoField({ idPrefix, defaultValue }: { idPrefix: string; defaultValue?: string | null }) {
  return (
    <div>
      <label className="label" htmlFor={`${idPrefix}-memo`}>
        メモ（任意）
      </label>
      <textarea
        className="input"
        id={`${idPrefix}-memo`}
        name="memo"
        rows={2}
        maxLength={500}
        defaultValue={defaultValue ?? undefined}
        placeholder="例：図形の問題がむずかしかった"
      />
    </div>
  );
}
