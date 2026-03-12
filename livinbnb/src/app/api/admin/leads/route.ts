import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'livinbnb-admin';
const auth = (req: NextRequest) => req.headers.get('x-admin-password') === ADMIN_PASSWORD;

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const leads = await prisma.livinbnbLead.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const lead = await prisma.livinbnbLead.create({ data: body });
  return NextResponse.json({ lead }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...data } = await req.json();
  const lead = await prisma.livinbnbLead.update({ where: { id }, data });
  return NextResponse.json({ lead });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await prisma.livinbnbLead.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
