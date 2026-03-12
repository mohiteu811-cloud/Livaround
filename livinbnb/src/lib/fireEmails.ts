import { LivinbnbListing, LivinbnbDestinationWish } from '@prisma/client';
import { prisma } from '@/lib/db';
import { findCycles, ListingNode } from '@/lib/matcher';
import { sendListingConfirmation, sendDestinationAlert, sendMatchFound } from '@/lib/email';

type ListingWithWishes = LivinbnbListing & { destinationWishes: LivinbnbDestinationWish[] };

export async function fireEmails(listing: ListingWithWishes | LivinbnbListing, boardUrl: string) {
  const wishes = 'destinationWishes' in listing ? listing.destinationWishes : [];
  const destinationDisplay = wishes.length > 0
    ? wishes.map(w => w.display).join(', ')
    : listing.destination;

  // 1. Confirmation to the new lister
  await sendListingConfirmation({
    to: listing.email,
    name: listing.name,
    location: listing.location,
    destination: destinationDisplay,
  }).catch(console.error);

  // 2. Alert anyone whose ANY wish matches the new listing's city/country
  // Check via destinationWishes table (new) + legacy destCity (old listings)
  const others = await prisma.livinbnbListing.findMany({
    where: {
      id: { not: listing.id },
      isPublic: true,
      OR: [
        // New-style: someone has a wish for the new listing's city
        {
          destinationWishes: {
            some: {
              OR: [
                { city: { equals: listing.city, mode: 'insensitive' } },
                { country: { equals: listing.country, mode: 'insensitive' } },
              ],
            },
          },
        },
        // Legacy: single destCity/destCountry
        { destCity: { equals: listing.city, mode: 'insensitive' } },
        { destCountry: { equals: listing.country, mode: 'insensitive' } },
      ],
    },
    include: { destinationWishes: true },
  });

  for (const other of others) {
    await sendDestinationAlert({
      to: other.email,
      recipientName: other.name,
      newListerName: listing.name,
      newListerLocation: listing.location,
      theirDestination: other.destinationWishes.length > 0
        ? other.destinationWishes.map(w => w.display).join(', ')
        : other.destination,
      boardUrl,
    }).catch(console.error);
  }

  // 3. Run matcher and notify on new cycles
  const all = await prisma.livinbnbListing.findMany({
    where: { isPublic: true },
    include: { destinationWishes: true },
  });

  const nodes: ListingNode[] = all.map(l => ({
    id: l.id,
    city: l.city,
    country: l.country,
    wishes: l.destinationWishes.length > 0
      ? l.destinationWishes.map(w => ({ city: w.city, country: w.country }))
      : [{ city: l.destCity, country: l.destCountry }],
    travelStart: l.travelStart,
    travelEnd: l.travelEnd,
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
