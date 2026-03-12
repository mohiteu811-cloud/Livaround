import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scrapeOg } from '@/lib/scrapeOg';
import { fireEmails } from '@/lib/fireEmails';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'livinbnb-admin';

function auth(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  return pw === ADMIN_PASSWORD;
}

// GET — list all listings for the admin table
export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const listings = await prisma.livinbnbListing.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ listings });
}

// POST — seed a listing on behalf of someone
export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { name, email, airbnbUrl, homeExchangeUrl, location, city, country,
            destination, destCity, destCountry, startDate, endDate, wishes } = body;

    if (!email || (!airbnbUrl && !homeExchangeUrl) || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const wishesList: { city: string; country: string; display: string }[] = wishes?.length
      ? wishes
      : destCity ? [{ city: destCity, country: destCountry ?? '', display: destination ?? destCity }] : [];

    if (wishesList.length === 0) {
      return NextResponse.json({ error: 'At least one destination required' }, { status: 400 });
    }
    const primary = wishesList[0];

    const og = await scrapeOg(airbnbUrl || homeExchangeUrl);

    const listing = await prisma.livinbnbListing.create({
      data: {
        name: name || 'Anonymous',
        email,
        airbnbUrl: airbnbUrl || null,
        homeExchangeUrl: homeExchangeUrl || null,
        title: og.title || `Home in ${city}`,
        location: location || `${city}, ${country}`,
        city,
        country,
        imageUrl: og.imageUrl,
        destination: primary.display,
        destCity: primary.city,
        destCountry: primary.country,
        travelStart: new Date(startDate),
        travelEnd: new Date(endDate),
        destinationWishes: { create: wishesList },
      },
      include: { destinationWishes: true },
    });

    const boardUrl = process.env.NEXT_PUBLIC_URL ?? 'https://livinbnb.up.railway.app';
    fireEmails(listing, boardUrl).catch(e => console.error('[email]', e));

    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/admin/seed]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — remove a listing by id
export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  await prisma.livinbnbListing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
