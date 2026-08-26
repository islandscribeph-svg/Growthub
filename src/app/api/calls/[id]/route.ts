import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const updateCallSchema = z.object({
  source: z.enum(["CONTENT", "ADS", "COLD_EMAIL", "REFERRAL", "UNKNOWN"]).optional(),
  qualified: z.enum(["QUALIFIED", "UNQUALIFIED", "PENDING"]).optional(),
  noShow: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.callEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.callEntry.update({ where: { id }, data: parsed.data });
  return NextResponse.json(entry);
}
