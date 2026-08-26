import type { CallSource, QualStatus } from "@prisma/client";

export type CallEntryRow = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  weekStart: string;
  source: CallSource;
  qualified: QualStatus;
  noShow: boolean;
  notes: string | null;
};

export type CallWeekNoteRow = {
  weekStart: string;
  body: string;
};
