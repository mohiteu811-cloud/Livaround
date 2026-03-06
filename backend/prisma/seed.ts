import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  const password = await bcrypt.hash('password123', 12);

  const hostUser = await prisma.user.upsert({
    where: { email: 'host@livaround.com' }, update: {},
    create: {
      name: 'Arjun Sharma', email: 'host@livaround.com', password,
      phone: '+91 98765 43210', role: 'HOST',
      host: { create: { name: 'Arjun Sharma Properties' } },
    },
    include: { host: true },
  });
  const host = hostUser.host!;

  const villa = await prisma.property.upsert({
    where: { id: 'prop-villa-bali' }, update: {},
    create: {
      id: 'prop-villa-bali', hostId: host.id, name: 'Villa Serenity',
      address: 'Jl. Raya Ubud No. 12', city: 'Ubud', country: 'Indonesia',
      description: 'A tranquil 4-bedroom villa with private pool, surrounded by rice fields.',
      type: 'VILLA', bedrooms: 4, bathrooms: 4, maxGuests: 8,
      amenities: JSON.stringify(['Pool','WiFi','Air Conditioning','Kitchen','Rice Field View','Parking']),
      images: JSON.stringify([]), isActive: true,
    },
  });

  const apartment = await prisma.property.upsert({
    where: { id: 'prop-apt-dubai' }, update: {},
    create: {
      id: 'prop-apt-dubai', hostId: host.id, name: 'Downtown Dubai Studio',
      address: 'Mohammed Bin Rashid Blvd', city: 'Dubai', country: 'UAE',
      description: 'Modern studio with Burj Khalifa views.',
      type: 'APARTMENT', bedrooms: 1, bathrooms: 1, maxGuests: 2,
      amenities: JSON.stringify(['WiFi','Air Conditioning','Gym','Pool','Concierge']),
      images: JSON.stringify([]), isActive: true,
    },
  });

  const cleanerUser = await prisma.user.upsert({
    where: { email: 'wayan@livaround.com' }, update: {},
    create: {
      name: 'Wayan Sukarta', email: 'wayan@livaround.com', password,
      phone: '+62 812 3456 7890', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['CLEANING']), isAvailable: true, location: 'Ubud, Bali', rating: 4.9, jobsCompleted: 47, bio: 'Professional villa cleaner with 5 years experience.' } },
    },
    include: { worker: true },
  });

  const driverUser = await prisma.user.upsert({
    where: { email: 'ketut@livaround.com' }, update: {},
    create: {
      name: 'Ketut Darmawan', email: 'ketut@livaround.com', password,
      phone: '+62 815 1122 3344', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['DRIVING']), isAvailable: true, location: 'Ubud, Bali', rating: 5.0, jobsCompleted: 89, bio: 'Licensed driver, knows all of Bali.' } },
    },
    include: { worker: true },
  });

  await prisma.user.upsert({
    where: { email: 'made@livaround.com' }, update: {},
    create: {
      name: 'Made Wijaya', email: 'made@livaround.com', password,
      phone: '+62 813 9876 5432', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['COOKING','CLEANING']), isAvailable: true, location: 'Ubud, Bali', rating: 4.8, jobsCompleted: 32, bio: 'Balinese cuisine specialist.' } },
    },
  });

  const now = new Date();

  const booking1 = await prisma.booking.upsert({
    where: { id: 'booking-001' }, update: {},
    create: {
      id: 'booking-001', propertyId: villa.id, guestName: 'Priya & Rahul Mehta',
      guestEmail: 'priya.mehta@gmail.com', guestPhone: '+91 99887 76655',
      checkIn: new Date(now.getTime() + 3*86400000), checkOut: new Date(now.getTime() + 10*86400000),
      guestCount: 4, totalAmount: 2100, currency: 'USD', status: 'CONFIRMED', source: 'AIRBNB',
      notes: 'Celebrating anniversary.',
    },
  });

  await prisma.booking.upsert({
    where: { id: 'booking-002' }, update: {},
    create: {
      id: 'booking-002', propertyId: villa.id, guestName: 'James & Sarah Wilson',
      guestEmail: 'jwilson@outlook.com',
      checkIn: new Date(now.getTime() - 2*86400000), checkOut: new Date(now.getTime() + 5*86400000),
      guestCount: 2, totalAmount: 1750, currency: 'USD', status: 'CHECKED_IN', source: 'DIRECT',
    },
  });

  await prisma.booking.upsert({
    where: { id: 'booking-003' }, update: {},
    create: {
      id: 'booking-003', propertyId: apartment.id, guestName: 'Ahmed Al Rashid',
      guestEmail: 'ahmed.r@hotmail.com', guestPhone: '+971 50 123 4567',
      checkIn: new Date(now.getTime() + 7*86400000), checkOut: new Date(now.getTime() + 14*86400000),
      guestCount: 2, totalAmount: 980, currency: 'USD', status: 'CONFIRMED', source: 'BOOKING_COM',
    },
  });

  await prisma.job.upsert({
    where: { id: 'job-001' }, update: {},
    create: {
      id: 'job-001', propertyId: villa.id, bookingId: booking1.id,
      workerId: cleanerUser.worker!.id, type: 'CLEANING', status: 'DISPATCHED',
      scheduledAt: new Date(now.getTime() + 3*86400000 - 2*3600000),
      notes: 'Pre-arrival deep clean. Prepare all 4 bedrooms.',
      checklist: JSON.stringify([
        { item: 'Vacuum all rooms', done: false }, { item: 'Change bed linens', done: false },
        { item: 'Clean bathrooms', done: false }, { item: 'Restock toiletries', done: false },
        { item: 'Clean kitchen', done: false }, { item: 'Pool area tidy up', done: false },
      ]),
    },
  });

  await prisma.job.upsert({
    where: { id: 'job-002' }, update: {},
    create: {
      id: 'job-002', propertyId: villa.id, type: 'COOKING', status: 'PENDING',
      scheduledAt: new Date(now.getTime() + 86400000 + 18*3600000),
      notes: 'Dinner for 2. Traditional Balinese cuisine.',
    },
  });

  await prisma.job.upsert({
    where: { id: 'job-003' }, update: {},
    create: {
      id: 'job-003', propertyId: villa.id, workerId: driverUser.worker!.id,
      type: 'DRIVING', status: 'ACCEPTED',
      scheduledAt: new Date(now.getTime() + 2*3600000),
      notes: 'Airport pickup — Ngurah Rai Airport at 14:00.',
    },
  });

  const inventoryItems = [
    { name: 'Toilet Paper Rolls', category: 'TOILETRIES', currentStock: 8, minStock: 12, unit: 'rolls', location: 'Main Bathroom Cabinet' },
    { name: 'Shampoo (500ml)', category: 'TOILETRIES', currentStock: 2, minStock: 4, unit: 'bottles', location: 'Bathroom Cabinet' },
    { name: 'Laundry Detergent', category: 'CLEANING_SUPPLIES', currentStock: 1, minStock: 2, unit: 'kg', location: 'Laundry Room' },
    { name: 'Dishwashing Liquid', category: 'CLEANING_SUPPLIES', currentStock: 0.5, minStock: 1, unit: 'litres', location: 'Kitchen Under Sink' },
    { name: 'Garbage Bags (L)', category: 'CLEANING_SUPPLIES', currentStock: 20, minStock: 30, unit: 'bags', location: 'Kitchen Drawer' },
    { name: 'Bath Towels', category: 'LINENS', currentStock: 12, minStock: 8, unit: 'pieces', location: 'Linen Cupboard' },
    { name: 'Bed Sheets (King)', category: 'LINENS', currentStock: 4, minStock: 4, unit: 'sets', location: 'Linen Cupboard' },
    { name: 'Coffee Pods', category: 'KITCHEN', currentStock: 5, minStock: 20, unit: 'pods', location: 'Kitchen Counter' },
  ];
  for (const item of inventoryItems) {
    await prisma.inventoryItem.create({ data: { ...item, propertyId: villa.id } }).catch(() => {});
  }

  await prisma.supplyCabinet.upsert({
    where: { qrCode: 'villa-serenity-main-cabinet' }, update: {},
    create: {
      propertyId: villa.id, name: 'Main Supply Cabinet',
      location: 'Ground floor hallway, next to laundry room',
      qrCode: 'villa-serenity-main-cabinet',
      description: 'Primary storage for cleaning supplies, toiletries and linens.',
    },
  });

  console.log('\nSeed complete! Login: host@livaround.com / password123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
