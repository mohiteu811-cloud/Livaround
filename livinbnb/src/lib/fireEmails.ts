import { LivinbnbListing } from '@prisma/client';
import { prisma } from '@/lib/db';
import { findCycles, ListingNode } from '@/lib/matcher';
import { sendListingConfirmation, sendDestinationAlert, sendMatchFound } from '@/lib/email';

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
