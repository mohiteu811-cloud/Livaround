/**
 * Seeds Villa Mo vendor contacts using the compiled Prisma client.
 * Runs with plain `node` — no TypeScript compilation needed.
 * All upserts use fixed IDs so this is safe to run on every deploy.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MO_CONTACTS = [
  { id: 'cnt-mo-01', agency: 'Electrician',                                  name: 'Eknath Baragundi',                phones: '["+91 76767 35006"]',                    company: 'TAG Engineers & Contractors',                 order: 1  },
  { id: 'cnt-mo-02', agency: 'Plumber',                                      name: 'Shantanu',                        phones: '["+91 96048 00926"]',                    company: 'TAG Engineers & Contractors',                 order: 2  },
  { id: 'cnt-mo-03', agency: 'HVAC',                                         name: 'Manoj Sharma',                    phones: '["+91 98238 66071","+91 74981 45368"]',  company: 'Aermech (Daikin)',                            order: 3  },
  { id: 'cnt-mo-04', agency: 'Solar Water Heater',                           name: 'Suhas Shetkar',                   phones: '["+91 83909 87181"]',                    company: 'Sansri Enterprises',                          order: 4  },
  { id: 'cnt-mo-05', agency: 'Swimming Pool Filter',                         name: 'Swapnil Naik',                    phones: '["+91 98812 28592"]',                    company: null,                                          order: 5  },
  { id: 'cnt-mo-06', agency: 'Landscape',                                    name: 'Mohan Thulasi',                   phones: '["+91 85534 23223"]',                    company: 'Shri Balaji Ganga Bhavani Seedling Supplier',  order: 6  },
  { id: 'cnt-mo-07', agency: 'Miscellaneous (Carpenter/Fabricator)',         name: 'Manoj Vishwakarma',               phones: '["+91 88983 39395"]',                    company: 'TAG Engineers & Contractors',                 order: 7  },
  { id: 'cnt-mo-08', agency: 'WiFi Connection',                              name: 'Parimal Shukla',                  phones: '["+91 95299 19829"]',                    company: 'Ethernet Express',                            order: 8  },
  { id: 'cnt-mo-09', agency: 'Automation',                                   name: 'Kedar Tandel',                    phones: '["+91 86551 55332"]',                    company: 'Technet (Mumbai)',                             order: 9  },
  { id: 'cnt-mo-10', agency: 'UPS, Battery & Stabiliser',                    name: 'Milind Choudhari',                phones: '["+91 92250 74577"]',                    company: 'Powersafe Engineers',                         order: 10 },
  { id: 'cnt-mo-11', agency: 'Kitchen - Electric Oven, Hob & Chimney',       name: 'Mann Chothani / Adi Dhargalkar',  phones: '["+91 95299 97308","+91 97641 05860"]',  company: 'Kaff',                                        order: 11 },
  { id: 'cnt-mo-12', agency: 'Kitchen - Built-in Refrigerator & Dishwasher', name: 'Darshan Kandolkar / Priti Singh', phones: '["+91 95526 11626"]',                    company: 'Carysil',                                     order: 12 },
  { id: 'cnt-mo-13', agency: 'Kitchen - Washing Machine',                    name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                    company: 'LG',                                          order: 13 },
  { id: 'cnt-mo-14', agency: 'Kitchen - Refrigerator',                       name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                    company: 'Samsung',                                     order: 14 },
  { id: 'cnt-mo-15', agency: 'Kitchen - Water Filter',                       name: 'Priti Singh',                     phones: '["+91 88501 76365"]',                    company: 'ZeroB',                                       order: 15 },
  { id: 'cnt-mo-16', agency: 'Kitchen - Microwave Oven',                     name: 'Helpline',                        phones: '["+91 92310 04321","+91 90281 29977"]',  company: 'IFB',                                         order: 16 },
  { id: 'cnt-mo-17', agency: 'Kitchen - Gas Cylinder',                       name: 'HP Gas near Siolim Church',       phones: '[]',                                     company: 'HP Gas',                                      order: 17 },
  { id: 'cnt-mo-18', agency: 'Society Manager',                              name: null,                              phones: '[]',                                     company: 'Casa Aurea',                                  order: 18 },
  { id: 'cnt-mo-19', agency: 'Carpenter',                                    name: 'Bhom Singh (locks and more)',     phones: '["+91 80007 50529"]',                    company: 'Freelance',                                   order: 19 },
  { id: 'cnt-mo-20', agency: 'Roof Tiles',                                   name: 'Shubham Todkar',                  phones: '["+91 78877 21111"]',                    company: 'Casa Aurea',                                  order: 20 },
  { id: 'cnt-mo-21', agency: 'MVR Homes Builder CRM',                        name: 'Devidas Shetkar',                 phones: '["+91 92090 04343"]',                    company: 'Casa Aurea',                                  order: 21 },
];

async function main() {
  const villaMo = await prisma.property.findFirst({
    where: { name: { contains: 'Villa Mo', mode: 'insensitive' } },
  });

  if (!villaMo) {
    console.log('seed-contacts: Villa Mo not found, skipping');
    return;
  }

  let seeded = 0;
  for (const c of MO_CONTACTS) {
    await prisma.propertyContact.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        propertyId: villaMo.id,
        agency: c.agency,
        name: c.name,
        phones: c.phones,
        company: c.company,
        order: c.order,
      },
    });
    seeded++;
  }
  console.log(`seed-contacts: seeded ${seeded} Villa Mo contacts`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
