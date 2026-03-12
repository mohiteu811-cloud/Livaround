import { NextRequest, NextResponse } from 'next/server';
import { LivinbnbListing } from '@prisma/client';
import { prisma } from '@/lib/db';
import { scrapeOg } from '@/lib/scrapeOg';
import { findCycles, ListingNode } from '@/lib/matcher';
import { sendListingConfirmation, sendDestinationAlert, sendMatchFound } from '@/lib/email';

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
            destination, destCity, destCountry, startDate, endDate } = body;

    if (!email || (!airbnbUrl && !homeExchangeUrl) || !destination || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
        destination,
        destCity,
        destCountry,
        travelStart: new Date(startDate),
        travelEnd: new Date(endDate),
      },
    });

    const boardUrl = process.env.NEXT_PUBLIC_URL ?? 'https://livinbnb.up.railway.app';

    // Fire-and-forget emails
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

// ── Shared email + match logic ────────────────────────────────────────────────

export async function fireEmails(listing: LivinbnbListing, boardUrl: string) {
  // 1. Confirmation to the new lister
  await sendListingConfirmation({
    to: listing.email,
    name: listing.name,
    location: listing.location,
    destination: listing.destination,
  }).catch(console.error);

  // 2. Alert anyone whose destination matches the new listing's city/country
  const others = await prisma.livinbnbListing.findMany({
    where: {
      id: { not: listing.id },
      isPublic: true,
      OR: [
        { destCity: { equals: listing.city, mode: 'insensitive' } },
        { destCountry: { equals: listing.country, mode: 'insensitive' } },
      ],
    },
  });

  for (const other of others) {
    await sendDestinationAlert({
      to: other.email,
      recipientName: other.name,
      newListerName: listing.name,
      newListerLocation: listing.location,
      theirDestination: other.destination,
      boardUrl,
    }).catch(console.error);
  }

  // 3. Run matcher and notify on new cycles
  const all = await prisma.livinbnbListing.findMany({ where: { isPublic: true } });
  const nodes: ListingNode[] = all.map((l: LivinbnbListing) => ({
    id: l.id, city: l.city, country: l.country,
    destCity: l.destCity, destCountry: l.destCountry,
    travelStart: l.travelStart, travelEnd: l.travelEnd,
  }));

  const cycles = findCycles(nodes);
  const listingMap = new Map(all.map(l => [l.id, l]));

  for (const cycle of cycles) {
    const sorted = [...cycle.ids].sort().join('|');
    const existing = await prisma.livinbnbMatch.findFirst({
      include: { participants: { orderBy: { position: 'asc' } } },
    });
    const alreadyExists = existing?.participants
      ? [...existing.participants].map(p => p.listingId).sort().join('|') === sorted
      : false;

    if (!alreadyExists) {
      await prisma.livinbnbMatch.create({
        data: {
          wayCount: cycle.wayCount,
          status: 'PROPOSED',
          participants: { create: cycle.ids.map((id, position) => ({ listingId: id, position })) },
        },
      });

      // Build human-readable cycle description: "Goa → London → Barcelona → Goa"
      const locations = cycle.ids.map(id => listingMap.get(id)?.location ?? '?');
      const cycleDescription = [...locations, locations[0]].join(' → ');

      for (const id of cycle.ids) {
        const participant = listingMap.get(id);
        if (participant) {
          await sendMatchFound({
            to: participant.email,
            recipientName: participant.name,
            cycleDescription,
            boardUrl,
          }).catch(console.error);
        }
      }
    }
  }
}
