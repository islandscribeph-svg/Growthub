import { prisma } from "@/lib/prisma";
import { toPlain } from "@/lib/serialize";
import { CallsDashboard } from "@/components/calls-dashboard";
import type { CallEntryRow, CallWeekNoteRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [entries, weekNotes] = await Promise.all([
    prisma.callEntry.findMany({ orderBy: { startTime: "desc" } }),
    prisma.callWeekNote.findMany(),
  ]);

  return (
    <div className="p-6">
      <CallsDashboard
        initialEntries={toPlain(entries) as unknown as CallEntryRow[]}
        initialWeekNotes={toPlain(weekNotes) as unknown as CallWeekNoteRow[]}
        calendarConfigured={Boolean(process.env.CALLS_CALENDAR_ICS_URL)}
      />
    </div>
  );
}
