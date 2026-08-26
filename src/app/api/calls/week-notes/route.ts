import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const weekNoteSchema = z.object({
  weekStart: z.string(),
  body: z.string(),
});

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = weekNoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const weekStart = new Date(parsed.data.weekStart);
  const note = await prisma.callWeekNote.upsert({
    where: { weekStart },
    create: { weekStart, body: parsed.data.body },
    update: { body: parsed.data.body },
  });

  return NextResponse.json(note);
}
