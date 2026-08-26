// Minimal RFC 5545 (iCalendar) VEVENT parser — just enough to read a Google
// Calendar "secret address in iCal format" feed (UID/SUMMARY/DESCRIPTION/
// DTSTART). Recurring events are read at their original DTSTART only; RRULE
// expansion isn't implemented, so only single-occurrence and already-past
// recurring instances that Google includes literally will show up.

export type IcsEvent = {
  uid: string;
  summary: string;
  description: string;
  start: Date;
};

function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function unfoldLines(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      unfolded.push(line);
    }
  }
  return unfolded;
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } {
  const colonIndex = line.indexOf(":");
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

function parseDate(value: string, params: Record<string, string>): Date | null {
  // All-day: VALUE=DATE, "YYYYMMDD"
  if (params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4));
    const m = Number(value.slice(4, 6));
    const d = Number(value.slice(6, 8));
    return new Date(y, m - 1, d);
  }
  // "YYYYMMDDTHHMMSS" (floating/local) or "YYYYMMDDTHHMMSSZ" (UTC)
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, z] = match;
  if (z) {
    return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  }
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

export function parseIcs(raw: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: { uid?: string; summary?: string; description?: string; start?: Date } | null = null;

  for (const line of unfoldLines(raw)) {
    const { name, params, value } = parseLine(line);
    if (name === "BEGIN" && value === "VEVENT") {
      current = {};
      continue;
    }
    if (name === "END" && value === "VEVENT") {
      if (current?.uid && current.start) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? "(untitled)",
          description: current.description ?? "",
          start: current.start,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    if (name === "UID") current.uid = value;
    else if (name === "SUMMARY") current.summary = unescapeText(value);
    else if (name === "DESCRIPTION") current.description = unescapeText(value);
    else if (name === "DTSTART") current.start = parseDate(value, params) ?? undefined;
  }

  return events;
}
