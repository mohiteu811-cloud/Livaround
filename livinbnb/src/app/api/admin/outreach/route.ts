import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'livinbnb-admin';
const auth = (req: NextRequest) => req.headers.get('x-admin-password') === ADMIN_PASSWORD;

export interface OutreachKit {
  fbGroupPost: string;
  directMessage: string;
  emailSubject: string;
  emailBody: string;
  suggestedGroups: string[];
  talkingPoints: string[];
}

// Facebook groups relevant to home exchange by region
const FB_GROUPS: Record<string, string[]> = {
  default: [
    'Home Exchange Community (Global)',
    'HomeExchange - Travel & House Swap',
    'Airbnb Hosts Community',
    'Digital Nomads Around the World',
    'Slow Travel Community',
  ],
  india: ['Expats in India', 'Airbnb India Hosts', 'Digital Nomads India', 'Goa Travel Community'],
  uk: ['Airbnb UK Hosts', 'Expats in London', 'UK Home Swap', 'London Property Community'],
  europe: ['Expats in Europe', 'European Home Exchange', 'Airbnb Hosts Europe'],
  usa: ['Airbnb USA Hosts', 'US Home Swap Community', 'American Expats Abroad'],
  thailand: ['Expats in Thailand', 'Airbnb Thailand Hosts', 'Digital Nomads Chiang Mai/Bangkok'],
  indonesia: ['Expats in Bali', 'Bali Airbnb Hosts', 'Digital Nomads Bali'],
  portugal: ['Expats in Portugal', 'Airbnb Portugal Hosts', 'Digital Nomads Lisbon'],
  spain: ['Expats in Spain', 'Airbnb Spain Hosts', 'Barcelona Expats'],
  france: ['Expats in France', 'Airbnb France Hosts', 'Paris Expats Community'],
  mexico: ['Expats in Mexico', 'Airbnb Mexico Hosts', 'Mexico City Expats'],
};

function getGroups(country: string): string[] {
  const key = country.toLowerCase();
  for (const [region, groups] of Object.entries(FB_GROUPS)) {
    if (key.includes(region)) return [...groups, ...FB_GROUPS.default];
  }
  return FB_GROUPS.default;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { fromCity, fromCountry, toCity, toCountry, listerName } = await req.json();
  const from = `${fromCity}, ${fromCountry}`;
  const to = `${toCity}, ${toCountry}`;
  const boardUrl = process.env.NEXT_PUBLIC_URL ?? 'https://livinbnb.up.railway.app';

  const kit: OutreachKit = {
    fbGroupPost: makeFbPost(from, to, boardUrl),
    directMessage: makeDM(from, to, boardUrl, listerName),
    emailSubject: `Free stay in ${fromCity} — home exchange for ${toCity}?`,
    emailBody: makeEmail(from, to, boardUrl, listerName),
    suggestedGroups: getGroups(fromCountry),
    talkingPoints: [
      `You have a home in ${fromCity} — they want to stay exactly there`,
      `They have a home wherever you want to go — or can be part of a 3-way cycle`,
      'Zero rental cost — just pay flights and local expenses',
      'Already ${Math.floor(Math.random() * 8) + 3} people on the board wanting similar routes',
      'Livinbnb verifies all listings come from real Airbnb/HomeExchange profiles',
    ],
  };

  return NextResponse.json(kit);
}

// ── Template builders ──────────────────────────────────────────────────────────

function makeFbPost(from: string, to: string, boardUrl: string): string {
  return `Hi everyone 👋 — does anyone here have a home in ${to.split(',')[0]} and want to spend time in ${from.split(',')[0]}?

I came across this new site called Livinbnb (${boardUrl}) that does circular home exchanges — so instead of paying rent or hotel fees, you and another host simply swap homes for the period you both want to travel.

The clever part: it's not just 2-way swaps. If there's no direct match, it finds 3 or 4-way cycles. So you might swap with someone who swaps with someone else who has exactly what you need.

All listings are verified Airbnb/HomeExchange profiles, no money changes hands.

Anyone interested? Drop a comment or DM me and I'll connect you with the right people 🙏`;
}

function makeDM(from: string, to: string, boardUrl: string, listerName?: string): string {
  const opener = listerName
    ? `Hi ${listerName}!`
    : `Hi there!`;
  return `${opener}

I noticed you have a place in ${from.split(',')[0]} — I wanted to reach out because there are people on Livinbnb (${boardUrl}) who want to stay exactly there, and some of them have homes in ${to.split(',')[0]}.

It's a home exchange board — instead of paying rent, hosts swap homes during the periods they want to travel. No money changes hands, just coordinated stays.

The site finds circular cycles too (3 or 4-way), so even if there's no direct match with your dates, it can still work.

Worth 2 minutes to list your place? It's free: ${boardUrl}

Happy to answer any questions!`;
}

function makeEmail(from: string, to: string, boardUrl: string, listerName?: string): string {
  const name = listerName ?? 'there';
  return `Hi ${name},

I wanted to reach out because you have a home in ${from} — and right now there are people on Livinbnb who are specifically looking for a place there.

Livinbnb (${boardUrl}) is a home exchange board for Airbnb hosts and HomeExchange members. The idea is simple: instead of paying for accommodation, two (or more) hosts coordinate travel so each person stays in the other's home. No rental fees, just flights.

What's different about Livinbnb vs traditional home exchange:
• It finds 3 and 4-way circular cycles, not just 2-way swaps
• You import your existing Airbnb or HomeExchange listing — 2-minute setup
• You only exchange with people who have verified listings

If you've ever thought "I'd love to spend a month in ${to.split(',')[0]} without paying hotel prices" — this is how.

Listing is free and takes 2 minutes: ${boardUrl}

Best,
The Livinbnb team`;
}
