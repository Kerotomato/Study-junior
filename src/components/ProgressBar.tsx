import { progressPercent } from "@/lib/points";
import type { Material } from "@/lib/types";

export function ProgressBar({ material }: { material: Material }) {
  const percent = progressPercent(material);
  const finished = material.current_page >= material.total_pages;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-bold">{material.name}</span>
        <span className="shrink-0 text-stone-500">
          {material.current_page}／{material.total_pages}ページ・{percent}%{material.laps > 0 && `（${material.laps}周完了）`}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${finished ? "bg-green-500" : "bg-brand"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
