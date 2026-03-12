import { NextRequest, NextResponse } from 'next/server';
import { LivinbnbListing } from '@prisma/client';
import { prisma } from '@/lib/db';
import { scrapeOg } from '@/lib/scrapeOg';
import { findCycles, ListingNode } from '@/lib/matcher';

// GET /api/listings — returns all public listings + match count
export async function GET() {
  try {
    const listings = await prisma.livinbnbListing.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
    });
    const matchCount = await prisma.livinbnbMatch.count();
    return NextResponse.json({ listings, matchCount });
  } catch (err) {
    console.error('[GET /api/listings]', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

// POST /api/listings — create a listing, scrape OG data, then re-run matcher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      name, email,
      airbnbUrl, homeExchangeUrl,
      location, city, country,
      destination, destCity, destCountry,
      startDate, endDate,
    } = body;

    if (!email || (!airbnbUrl && !homeExchangeUrl) || !destination || !startDate || !endDate) {
      return NextResponse.json({ error: 'Please provide at least one listing URL and all required fields.' }, { status: 400 });
    }

    // Scrape OG data — prefer Airbnb for image quality, fall back to HomeExchange
    const og = await scrapeOg(airbnbUrl || homeExchangeUrl);

    const listing = await prisma.livinbnbListing.create({
      data: {
        name: name ?? 'Anonymous',
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

    // Run matcher async — don't block the response
    runMatcher().catch(e => console.error('[matcher]', e));

    return NextResponse.json({ listing }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/listings]', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

// ── Matcher runner ───────────────────────────────────────────────────────────

async function runMatcher() {
  const all = await prisma.livinbnbListing.findMany({ where: { isPublic: true } });

  const nodes: ListingNode[] = all.map((l: LivinbnbListing) => ({
    id: l.id,
    city: l.city,
    country: l.country,
    destCity: l.destCity,
    destCountry: l.destCountry,
    travelStart: l.travelStart,
    travelEnd: l.travelEnd,
  }));

  const cycles = findCycles(nodes);

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
          participants: {
            create: cycle.ids.map((id, position) => ({ listingId: id, position })),
          },
        },
      });
    }
  }
}
