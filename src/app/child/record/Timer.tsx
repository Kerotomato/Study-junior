"use client";

import { useEffect, useState } from "react";
import { saveStudyLog } from "@/app/actions/study";
import type { Material, Subject } from "@/lib/types";

const STORAGE_KEY = "study-timer";

interface TimerState {
  startedAt: string;
  /** 一時停止までに積み上がった時間（ミリ秒） */
  elapsedMs: number;
  /** 動いている区間の開始時刻。一時停止中は null */
  runningSince: number | null;
}

function load(): TimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}

function save(state: TimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 保存できなくてもタイマーは動かす
  }
}

function elapsed(state: TimerState, now: number): number {
  return state.elapsedMs + (state.runningSince === null ? 0 : now - state.runningSince);
}

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 開始／一時停止／終了。ページを閉じても続きから再開できるようブラウザに保存する */
export function Timer({ subjects, materials }: { subjects: Subject[]; materials: Material[] }) {
  const [state, setState] = useState<TimerState | null>(null);
  const [stopped, setStopped] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const saved = load();
    if (saved) setState(saved);
  }, []);

  useEffect(() => {
    if (!state?.runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state?.runningSince]);

  function update(next: TimerState | null) {
    setState(next);
    save(next);
    setNow(Date.now());
  }

  function start() {
    const t = Date.now();
    setStopped(false);
    update({ startedAt: new Date(t).toISOString(), elapsedMs: 0, runningSince: t });
  }

  function pause() {
    if (!state || state.runningSince === null) return;
    update({ ...state, elapsedMs: elapsed(state, Date.now()), runningSince: null });
  }

  function resume() {
    if (!state) return;
    update({ ...state, runningSince: Date.now() });
  }

  function stop() {
    pause();
    setStopped(true);
  }

  function discard() {
    setStopped(false);
    update(null);
  }

  const ms = state ? elapsed(state, now) : 0;
  const minutes = Math.floor(ms / 60000);

  return (
    <div className="space-y-4">
      <p className="text-center font-mono text-5xl font-bold tabular-nums">{clock(ms)}</p>
      {!stopped && (
        <div className="flex justify-center gap-2">
          {!state && (
            <button type="button" className="btn px-8" onClick={start}>
              開始
            </button>
          )}
          {state?.runningSince && (
            <button type="button" className="btn-sub px-6" onClick={pause}>
              一時停止
            </button>
          )}
          {state && !state.runningSince && (
            <button type="button" className="btn px-6" onClick={resume}>
              再開
            </button>
          )}
          {state && (
            <button type="button" className="btn-danger px-6" onClick={stop}>
              終了
            </button>
          )}
        </div>
      )}

      {stopped && state && (
        <form
          action={async (form) => {
            save(null);
            await saveStudyLog(form);
          }}
          className="space-y-3"
        >
          <input type="hidden" name="method" value="timer" />
          <input type="hidden" name="started_at" value={state.startedAt} />
          <input type="hidden" name="minutes" value={minutes} />
          <p className="text-center text-sm">
            {minutes < 1 ? "1分未満のため保存できません" : `${minutes}分を記録します`}
          </p>
          <StudyFields subjects={subjects} materials={materials} idPrefix="timer" />
          <div className="flex gap-2">
            <button type="button" className="btn-sub flex-1" onClick={discard}>
              記録しない
            </button>
            <button className="btn flex-1" disabled={minutes < 1}>
              保存する
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** 科目・教材・ページの入力欄（タイマーと手入力で共通） */
export function StudyFields({ subjects, materials, idPrefix }: { subjects: Subject[]; materials: Material[]; idPrefix: string }) {
  return (
    <>
      <div>
        <label className="label" htmlFor={`${idPrefix}-subject_id`}>科目</label>
        <select className="input" id={`${idPrefix}-subject_id`} name="subject_id" required defaultValue="">
          <option value="" disabled>
            選んでください
          </option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {materials.length > 0 && (
        <div className="grid grid-cols-[1fr_8rem] gap-2">
          <div>
            <label className="label" htmlFor={`${idPrefix}-material_id`}>教材（任意）</label>
            <select className="input" id={`${idPrefix}-material_id`} name="material_id" defaultValue="">
              <option value="">なし</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}（いま p.{m.current_page}）
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-pages_to`}>何ページまで</label>
            <input className="input" id={`${idPrefix}-pages_to`} name="pages_to" inputMode="numeric" pattern="\d*" />
          </div>
        </div>
      )}
    </>
  );
}
