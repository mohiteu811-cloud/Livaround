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
    where: { id: 'prop-villa-goa' }, update: {},
    create: {
      id: 'prop-villa-goa', hostId: host.id, name: 'Villa Sussegad',
      address: '14 Gauravaddo, Calangute', city: 'Calangute', country: 'India',
      description: 'A serene 4-bedroom villa with private pool, surrounded by tropical gardens, minutes from the beach.',
      type: 'VILLA', bedrooms: 4, bathrooms: 4, maxGuests: 8,
      amenities: JSON.stringify(['Pool','WiFi','Air Conditioning','Kitchen','Garden','Parking','BBQ']),
      images: JSON.stringify([]), isActive: true,
    },
  });

  const cottage = await prisma.property.upsert({
    where: { id: 'prop-cottage-goa' }, update: {},
    create: {
      id: 'prop-cottage-goa', hostId: host.id, name: 'Casa Anjuna',
      address: '7 Mazal Waddo, Anjuna', city: 'Anjuna', country: 'India',
      description: 'Charming 2-bedroom Portuguese-style cottage near Anjuna beach with a private courtyard.',
      type: 'COTTAGE', bedrooms: 2, bathrooms: 2, maxGuests: 4,
      amenities: JSON.stringify(['WiFi','Air Conditioning','Kitchen','Courtyard','Parking']),
      images: JSON.stringify([]), isActive: true,
    },
  });

  const cleanerUser = await prisma.user.upsert({
    where: { email: 'preeti@livaround.com' }, update: {},
    create: {
      name: 'Preeti Dessai', email: 'preeti@livaround.com', password,
      phone: '+91 94220 11234', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['CLEANING']), isAvailable: true, location: 'Calangute, Goa', rating: 4.9, jobsCompleted: 47, bio: 'Professional villa cleaner with 5 years experience in Goa.' } },
    },
    include: { worker: true },
  });

  const driverUser = await prisma.user.upsert({
    where: { email: 'carlos@livaround.com' }, update: {},
    create: {
      name: 'Carlos Fernandes', email: 'carlos@livaround.com', password,
      phone: '+91 98221 55678', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['DRIVING']), isAvailable: true, location: 'Panjim, Goa', rating: 5.0, jobsCompleted: 89, bio: 'Licensed driver, knows every corner of Goa.' } },
    },
    include: { worker: true },
  });

  await prisma.user.upsert({
    where: { email: 'rohan@livaround.com' }, update: {},
    create: {
      name: 'Rohan Naik', email: 'rohan@livaround.com', password,
      phone: '+91 91300 77890', role: 'WORKER',
      worker: { create: { skills: JSON.stringify(['COOKING','CLEANING']), isAvailable: true, location: 'Anjuna, Goa', rating: 4.8, jobsCompleted: 32, bio: 'Goan cuisine specialist — seafood curries, bebinca, and more.' } },
    },
  });

  const now = new Date();

  const booking1 = await prisma.booking.upsert({
    where: { id: 'booking-001' }, update: {},
    create: {
      id: 'booking-001', propertyId: villa.id, guestName: 'Priya & Rahul Mehta',
      guestEmail: 'priya.mehta@gmail.com', guestPhone: '+91 99887 76655',
      checkIn: new Date(now.getTime() + 3*86400000), checkOut: new Date(now.getTime() + 10*86400000),
      guestCount: 4, totalAmount: 175000, currency: 'INR', status: 'CONFIRMED', source: 'AIRBNB',
      notes: 'Celebrating anniversary. Prefer early check-in if possible.',
    },
  });

  await prisma.booking.upsert({
    where: { id: 'booking-002' }, update: {},
    create: {
      id: 'booking-002', propertyId: villa.id, guestName: 'James & Sarah Wilson',
      guestEmail: 'jwilson@outlook.com',
      checkIn: new Date(now.getTime() - 2*86400000), checkOut: new Date(now.getTime() + 5*86400000),
      guestCount: 2, totalAmount: 140000, currency: 'INR', status: 'CHECKED_IN', source: 'DIRECT',
    },
  });

  await prisma.booking.upsert({
    where: { id: 'booking-003' }, update: {},
    create: {
      id: 'booking-003', propertyId: cottage.id, guestName: 'Sneha & Dev Kapoor',
      guestEmail: 'sneha.kapoor@gmail.com', guestPhone: '+91 97300 12345',
      checkIn: new Date(now.getTime() + 7*86400000), checkOut: new Date(now.getTime() + 14*86400000),
      guestCount: 2, totalAmount: 84000, currency: 'INR', status: 'CONFIRMED', source: 'BOOKING_COM',
      notes: 'First time in Goa — restaurant recommendations welcome.',
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
    where: { id: 'job-003' }, update: {},
    create: {
      id: 'job-003', propertyId: villa.id, workerId: driverUser.worker!.id,
      type: 'DRIVING', status: 'ACCEPTED',
      scheduledAt: new Date(now.getTime() + 2*3600000),
      notes: 'Airport pickup — Goa Mopa International Airport at 14:00.',
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
    where: { qrCode: 'villa-sussegad-main-cabinet' }, update: {},
    create: {
      propertyId: villa.id, name: 'Main Supply Cabinet',
      location: 'Ground floor hallway, next to laundry room',
      qrCode: 'villa-sussegad-main-cabinet',
      description: 'Primary storage for cleaning supplies, toiletries and linens.',
    },
  });

  // ── Dummy owners ────────────────────────────────────────────────────────────

  const ownerPassword = await bcrypt.hash('owner123', 12);

  // Owner 1: Mohit Lalvani — Villa Sussegad
  const mohitUser = await prisma.user.upsert({
    where: { email: 'mohit@livaround.com' }, update: {},
    create: {
      name: 'Mohit Lalvani', email: 'mohit@livaround.com',
      password: ownerPassword, phone: '+91 98201 55678', role: 'OWNER',
      owner: { create: {} },
    },
    include: { owner: true },
  });
  await prisma.propertyOwnership.upsert({
    where: { ownerId_propertyId: { ownerId: mohitUser.owner!.id, propertyId: villa.id } },
    update: {},
    create: {
      ownerId: mohitUser.owner!.id, propertyId: villa.id,
      involvementLevel: 'FINANCIAL', ownershipPercent: 100, commissionPct: 20,
    },
  });

  // Owner 2: Priya Desai — Casa Anjuna
  const priyaUser = await prisma.user.upsert({
    where: { email: 'priya.desai@livaround.com' }, update: {},
    create: {
      name: 'Priya Desai', email: 'priya.desai@livaround.com',
      password: ownerPassword, phone: '+91 97301 22345', role: 'OWNER',
      owner: { create: {} },
    },
    include: { owner: true },
  });
  await prisma.propertyOwnership.upsert({
    where: { ownerId_propertyId: { ownerId: priyaUser.owner!.id, propertyId: cottage.id } },
    update: {},
    create: {
      ownerId: priyaUser.owner!.id, propertyId: cottage.id,
      involvementLevel: 'FINANCIAL', ownershipPercent: 100, commissionPct: 20,
    },
  });

  // ── Villa Mo vendor contacts ────────────────────────────────────────────────
  // Use hardcoded ID to avoid matching the duplicate "Villa Mo" test property
  const villaMo = await prisma.property.findUnique({ where: { id: 'cmmiyun9s001d7485xp9ysdve' } });
  if (villaMo) {
    const moContacts = [
      { id: 'cnt-mo-01', agency: 'Electrician',                                  name: 'Eknath Baragundi',                phones: '["+91 76767 35006"]',                      company: 'TAG Engineers & Contractors',                order: 1  },
      { id: 'cnt-mo-02', agency: 'Plumber',                                      name: 'Shantanu',                        phones: '["+91 96048 00926"]',                      company: 'TAG Engineers & Contractors',                order: 2  },
      { id: 'cnt-mo-03', agency: 'HVAC',                                         name: 'Manoj Sharma',                    phones: '["+91 98238 66071","+91 74981 45368"]',    company: 'Aermech (Daikin)',                            order: 3  },
      { id: 'cnt-mo-04', agency: 'Solar Water Heater',                           name: 'Suhas Shetkar',                   phones: '["+91 83909 87181"]',                      company: 'Sansri Enterprises',                         order: 4  },
      { id: 'cnt-mo-05', agency: 'Swimming Pool Filter',                         name: 'Swapnil Naik',                    phones: '["+91 98812 28592"]',                      company: null,                                         order: 5  },
      { id: 'cnt-mo-06', agency: 'Landscape',                                    name: 'Mohan Thulasi',                   phones: '["+91 85534 23223"]',                      company: 'Shri Balaji Ganga Bhavani Seedling Supplier', order: 6  },
      { id: 'cnt-mo-07', agency: 'Miscellaneous (Carpenter/Fabricator)',         name: 'Manoj Vishwakarma',               phones: '["+91 88983 39395"]',                      company: 'TAG Engineers & Contractors',                order: 7  },
      { id: 'cnt-mo-08', agency: 'WiFi Connection',                              name: 'Parimal Shukla',                  phones: '["+91 95299 19829"]',                      company: 'Ethernet Express',                           order: 8  },
      { id: 'cnt-mo-09', agency: 'Automation',                                   name: 'Kedar Tandel',                    phones: '["+91 86551 55332"]',                      company: 'Technet (Mumbai)',                            order: 9  },
      { id: 'cnt-mo-10', agency: 'UPS, Battery & Stabiliser',                    name: 'Milind Choudhari',                phones: '["+91 92250 74577"]',                      company: 'Powersafe Engineers',                        order: 10 },
      { id: 'cnt-mo-11', agency: 'Kitchen - Electric Oven, Hob & Chimney',       name: 'Mann Chothani / Adi Dhargalkar',  phones: '["+91 95299 97308","+91 97641 05860"]',    company: 'Kaff',                                       order: 11 },
      { id: 'cnt-mo-12', agency: 'Kitchen - Built-in Refrigerator & Dishwasher', name: 'Darshan Kandolkar / Priti Singh', phones: '["+91 95526 11626"]',                      company: 'Carysil',                                    order: 12 },
      { id: 'cnt-mo-13', agency: 'Kitchen - Washing Machine',                    name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                      company: 'LG',                                         order: 13 },
      { id: 'cnt-mo-14', agency: 'Kitchen - Refrigerator',                       name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                      company: 'Samsung',                                    order: 14 },
      { id: 'cnt-mo-15', agency: 'Kitchen - Water Filter',                       name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                      company: 'ZeroB',                                      order: 15 },
      { id: 'cnt-mo-16', agency: 'Kitchen - Microwave Oven',                     name: 'Helpline',                        phones: '["+91 92310 04321","+91 90281 29977"]',    company: 'IFB',                                        order: 16 },
      { id: 'cnt-mo-17', agency: 'Kitchen - Gas Cylinder',                       name: 'HP Gas near Siolim Church',       phones: '[]',                                       company: 'HP Gas',                                     order: 17 },
      { id: 'cnt-mo-18', agency: 'Society Manager',                              name: null,                              phones: '[]',                                       company: 'Casa Aurea',                                 order: 18 },
      { id: 'cnt-mo-19', agency: 'Carpenter',                                    name: 'Bhom Singh (locks and more)',     phones: '["+91 80007 50529"]',                      company: 'Freelance',                                  order: 19 },
      { id: 'cnt-mo-20', agency: 'Roof Tiles',                                   name: 'Shubham Todkar',                  phones: '["+91 78877 21111"]',                      company: 'Casa Aurea',                                 order: 20 },
      { id: 'cnt-mo-21', agency: 'MVR Homes Builder CRM',                        name: 'Devidas Shetkar',                 phones: '["+91 92090 04343"]',                      company: 'Casa Aurea',                                 order: 21 },
    ];
    for (const c of moContacts) {
      await prisma.propertyContact.upsert({
        where: { id: c.id },
        update: { propertyId: villaMo.id },
        create: { id: c.id, propertyId: villaMo.id, agency: c.agency, name: c.name, phones: c.phones, company: c.company, order: c.order },
      });
    }
    console.log(`  Villa Mo contacts seeded (${moContacts.length})`);
  }

  console.log('\nSeed complete!');
  console.log('  Host:    host@livaround.com / password123');
  console.log('  Owner 1: mohit@livaround.com / owner123  → Villa Sussegad');
  console.log('  Owner 2: priya.desai@livaround.com / owner123  → Casa Anjuna');
  console.log('  Login URL: /owner/login');
}

main().catch(console.error).finally(() => prisma.$disconnect());
