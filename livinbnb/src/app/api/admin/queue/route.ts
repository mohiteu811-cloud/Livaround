import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'livinbnb-admin';
const auth = (req: NextRequest) => req.headers.get('x-admin-password') === ADMIN_PASSWORD;

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const posts = await prisma.livinbnbOutreachPost.findMany({
    orderBy: { scheduledAt: 'asc' },
  });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  // body may be a single post or an array (bulk schedule from Outreach tab)
  if (Array.isArray(body)) {
    const created = await prisma.livinbnbOutreachPost.createMany({ data: body });
    return NextResponse.json({ count: created.count }, { status: 201 });
  }
  const post = await prisma.livinbnbOutreachPost.create({ data: body });
  return NextResponse.json({ post }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...data } = await req.json();
  const post = await prisma.livinbnbOutreachPost.update({ where: { id }, data });
  return NextResponse.json({ post });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await prisma.livinbnbOutreachPost.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
