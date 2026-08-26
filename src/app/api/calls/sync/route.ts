import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseIcs } from "@/lib/ics";
import { weekStartFor } from "@/lib/call-weeks";
import { guessSource, guessQualified, guessNoShow } from "@/lib/call-parsing";

// Bounds how much history a sync pulls in, so re-syncing a long-lived
// calendar doesn't churn through years of past events every time.
const SYNC_WINDOW_PAST_DAYS = 26 * 7;
const SYNC_WINDOW_FUTURE_DAYS = 14;

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const icsUrl = process.env.CALLS_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return NextResponse.json({ error: "CALLS_CALENDAR_ICS_URL is not configured" }, { status: 500 });
  }

  const res = await fetch(icsUrl, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: `Failed to fetch calendar feed (${res.status})` }, { status: 502 });
  }
  const raw = await res.text();
  const events = parseIcs(raw);

  const now = Date.now();
  const windowStart = now - SYNC_WINDOW_PAST_DAYS * 24 * 60 * 60 * 1000;
  const windowEnd = now + SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000;
  const inWindow = events.filter((e) => e.start.getTime() >= windowStart && e.start.getTime() <= windowEnd);

  let created = 0;
  let updated = 0;

  for (const event of inWindow) {
    const text = `${event.summary} ${event.description}`;
    const existed = await prisma.callEntry.findUnique({
      where: { calendarEventId: event.uid },
      select: { id: true },
    });
    await prisma.callEntry.upsert({
      where: { calendarEventId: event.uid },
      create: {
        calendarEventId: event.uid,
        title: event.summary,
        description: event.description || null,
        startTime: event.start,
        weekStart: weekStartFor(event.start),
        source: guessSource(text),
        qualified: guessQualified(text),
        noShow: guessNoShow(text),
      },
      // Re-syncing only refreshes what the calendar owns (title/time/
      // description) — source/qualified/noShow are left alone so a manual
      // correction in the dashboard never gets clobbered by a later sync.
      update: {
        title: event.summary,
        description: event.description || null,
        startTime: event.start,
        weekStart: weekStartFor(event.start),
      },
    });
    if (existed) updated++;
    else created++;
  }

  return NextResponse.json({ synced: inWindow.length, created, updated });
}
