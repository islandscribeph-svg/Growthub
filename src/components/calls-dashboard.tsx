"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CallEntryRow, CallWeekNoteRow } from "@/lib/types";
import type { CallSource, QualStatus } from "@prisma/client";
import { CALL_SOURCE_LABELS, CALL_SOURCE_ORDER } from "@/lib/call-parsing";
import { weekLabel } from "@/lib/call-weeks";

type Bucket = "QUALIFIED" | "UNQUALIFIED" | "QUALIFIED_NO_SHOW" | "UNQUALIFIED_NO_SHOW" | "PENDING";

const BUCKET_ORDER: Bucket[] = ["QUALIFIED", "UNQUALIFIED", "QUALIFIED_NO_SHOW", "UNQUALIFIED_NO_SHOW", "PENDING"];
const BUCKET_LABELS: Record<Bucket, string> = {
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  QUALIFIED_NO_SHOW: "Qualified + No Show",
  UNQUALIFIED_NO_SHOW: "Unqualified + No Show",
  PENDING: "Pending",
};

function bucketFor(entry: CallEntryRow): Bucket {
  if (entry.qualified === "PENDING") return "PENDING";
  if (entry.noShow) return entry.qualified === "QUALIFIED" ? "QUALIFIED_NO_SHOW" : "UNQUALIFIED_NO_SHOW";
  return entry.qualified === "QUALIFIED" ? "QUALIFIED" : "UNQUALIFIED";
}

export function CallsDashboard({
  initialEntries,
  initialWeekNotes,
  calendarConfigured,
}: {
  initialEntries: CallEntryRow[];
  initialWeekNotes: CallWeekNoteRow[];
  calendarConfigured: boolean;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [weekNotes, setWeekNotes] = useState<Record<string, string>>(
    Object.fromEntries(initialWeekNotes.map((n) => [n.weekStart, n.body])),
  );
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const weeks = useMemo(() => {
    const groups = new Map<string, CallEntryRow[]>();
    for (const entry of entries) {
      const list = groups.get(entry.weekStart) ?? [];
      list.push(entry);
      groups.set(entry.weekStart, list);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([weekStart, weekEntries]) => ({
        weekStart,
        entries: weekEntries.sort((a, b) => (a.startTime < b.startTime ? 1 : -1)),
      }));
  }, [entries]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    const res = await fetch("/api/calls/sync", { method: "POST" });
    setSyncing(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setSyncMessage(body?.error ?? "Sync failed.");
      return;
    }
    const body = await res.json();
    setSyncMessage(`Synced ${body.synced} events (${body.created} new, ${body.updated} updated).`);
    router.refresh();
  }

  async function updateEntry(id: string, patch: Partial<Pick<CallEntryRow, "source" | "qualified" | "noShow" | "notes">>) {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    await fetch(`/api/calls/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function saveWeekNote(weekStart: string, body: string) {
    setWeekNotes((notes) => ({ ...notes, [weekStart]: body }));
    await fetch("/api/calls/week-notes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart, body }),
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">Calls</h1>
        <div className="flex items-center gap-3">
          {syncMessage && <span className="text-sm text-neutral-500">{syncMessage}</span>}
          <button
            onClick={handleSync}
            disabled={syncing || !calendarConfigured}
            title={calendarConfigured ? undefined : "Set CALLS_CALENDAR_ICS_URL to enable syncing"}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync from calendar"}
          </button>
        </div>
      </div>

      {!calendarConfigured && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          No calendar connected yet. Set <code className="font-mono">CALLS_CALENDAR_ICS_URL</code> to the
          calendar&apos;s secret iCal address (Google Calendar → Settings → that calendar → &quot;Secret address in
          iCal format&quot;) to enable syncing.
        </p>
      )}

      {weeks.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white p-8 text-center text-neutral-400">
          No calls synced yet.
        </p>
      )}

      <div className="space-y-6">
        {weeks.map((week) => (
          <WeekSection
            key={week.weekStart}
            weekStart={week.weekStart}
            entries={week.entries}
            note={weekNotes[week.weekStart] ?? ""}
            onUpdateEntry={updateEntry}
            onSaveNote={(body) => saveWeekNote(week.weekStart, body)}
          />
        ))}
      </div>
    </div>
  );
}

function WeekSection({
  weekStart,
  entries,
  note,
  onUpdateEntry,
  onSaveNote,
}: {
  weekStart: string;
  entries: CallEntryRow[];
  note: string;
  onUpdateEntry: (id: string, patch: Partial<Pick<CallEntryRow, "source" | "qualified" | "noShow" | "notes">>) => void;
  onSaveNote: (body: string) => void;
}) {
  const [noteDraft, setNoteDraft] = useState(note);

  const counts = useMemo(() => {
    const grid: Record<CallSource, Record<Bucket, number>> = Object.fromEntries(
      CALL_SOURCE_ORDER.map((s) => [s, Object.fromEntries(BUCKET_ORDER.map((b) => [b, 0])) as Record<Bucket, number>]),
    ) as Record<CallSource, Record<Bucket, number>>;
    for (const entry of entries) {
      grid[entry.source][bucketFor(entry)]++;
    }
    return grid;
  }, [entries]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">{weekLabel(new Date(weekStart))}</h2>
        <span className="text-xs text-neutral-500">
          {entries.length} call{entries.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="py-1.5 text-left font-medium">Source</th>
              {BUCKET_ORDER.map((b) => (
                <th key={b} className="py-1.5 text-right font-medium">
                  {BUCKET_LABELS[b]}
                </th>
              ))}
              <th className="py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {CALL_SOURCE_ORDER.map((source) => {
              const row = counts[source];
              const total = BUCKET_ORDER.reduce((sum, b) => sum + row[b], 0);
              return (
                <tr key={source} className="border-t border-neutral-100">
                  <td className="py-1.5 text-neutral-700">{CALL_SOURCE_LABELS[source]}</td>
                  {BUCKET_ORDER.map((b) => (
                    <td key={b} className="py-1.5 text-right text-neutral-600">
                      {row[b] || "–"}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-medium text-neutral-900">{total || "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-4 space-y-2">
        {entries.map((entry) => (
          <CallRow key={entry.id} entry={entry} onUpdate={(patch) => onUpdateEntry(entry.id, patch)} />
        ))}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-500">Concerns</span>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => noteDraft !== note && onSaveNote(noteDraft)}
          rows={2}
          className="input"
          placeholder="Notes on this week's calls..."
        />
      </label>
    </div>
  );
}

function CallRow({
  entry,
  onUpdate,
}: {
  entry: CallEntryRow;
  onUpdate: (patch: Partial<Pick<CallEntryRow, "source" | "qualified" | "noShow" | "notes">>) => void;
}) {
  const [notesDraft, setNotesDraft] = useState(entry.notes ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-100 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-neutral-900">{entry.title}</p>
        <p className="text-xs text-neutral-500">
          {new Date(entry.startTime).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <select
        value={entry.source}
        onChange={(e) => onUpdate({ source: e.target.value as CallSource })}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
      >
        {CALL_SOURCE_ORDER.map((s) => (
          <option key={s} value={s}>
            {CALL_SOURCE_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        value={entry.qualified}
        onChange={(e) => onUpdate({ qualified: e.target.value as QualStatus })}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
      >
        <option value="PENDING">Pending</option>
        <option value="QUALIFIED">Qualified</option>
        <option value="UNQUALIFIED">Unqualified</option>
      </select>
      <label className="flex items-center gap-1 text-xs text-neutral-600">
        <input type="checkbox" checked={entry.noShow} onChange={(e) => onUpdate({ noShow: e.target.checked })} />
        No show
      </label>
      <input
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onBlur={() => notesDraft !== (entry.notes ?? "") && onUpdate({ notes: notesDraft || null })}
        placeholder="Notes..."
        className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-xs"
      />
    </div>
  );
}
