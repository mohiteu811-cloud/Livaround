import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { scrapeOg } from '@/lib/scrapeOg';
import { fireEmails } from '@/lib/fireEmails';

// GET /api/listings — returns all public listings + match count + destination demand
export async function GET() {
  try {
    const listings = await prisma.livinbnbListing.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      include: { destinationWishes: true },
    });
    const matchCount = await prisma.livinbnbMatch.count();

    // Aggregate demand across all wishes + legacy destCity
    const demand: Record<string, number> = {};
    for (const l of listings) {
      const cities = l.destinationWishes.length > 0
        ? l.destinationWishes.map(w => w.city)
        : [l.destCity];
      for (const city of cities) {
        if (city) demand[city] = (demand[city] ?? 0) + 1;
      }
    }
    const topDestinations = Object.entries(demand)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    return NextResponse.json({ listings, matchCount, topDestinations });
  } catch (err) {
    console.error('[GET /api/listings]', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}

// POST /api/listings — create a listing, scrape OG, fire emails + matcher
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, email, airbnbUrl, homeExchangeUrl, location, city, country,
      destination, destCity, destCountry, startDate, endDate,
      // wishes: [{city, country, display}] — if provided, overrides single destination
      wishes,
    } = body;

    if (!email || (!airbnbUrl && !homeExchangeUrl) || !startDate || !endDate) {
      return NextResponse.json({ error: 'Please provide at least one listing URL and all required fields.' }, { status: 400 });
    }

    const wishesList: { city: string; country: string; display: string }[] = wishes?.length
      ? wishes
      : destCity ? [{ city: destCity, country: destCountry ?? '', display: destination ?? destCity }] : [];

    if (wishesList.length === 0) {
      return NextResponse.json({ error: 'Please add at least one destination.' }, { status: 400 });
    }

    const og = await scrapeOg(airbnbUrl || homeExchangeUrl);
    // Primary destination = first wish
    const primary = wishesList[0];

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
    console.error('[POST /api/listings]', err);
    return NextResponse.json({ error: 'Database error', detail: String(err) }, { status: 500 });
  }
}
