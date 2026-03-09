-- Seed vendor contacts for Villa Mo
-- Uses a subquery to find the property by name so the ID doesn't need to be hardcoded

DO $$
DECLARE
  villa_mo_id TEXT;
BEGIN
  SELECT id INTO villa_mo_id FROM "Property" WHERE name ILIKE '%villa mo%' LIMIT 1;
  IF villa_mo_id IS NULL THEN
    RAISE NOTICE 'Villa Mo not found — skipping contact seed';
    RETURN;
  END IF;

  INSERT INTO "PropertyContact" ("id","propertyId","agency","name","phones","company","order","createdAt","updatedAt") VALUES
    ('cnt-mo-01', villa_mo_id, 'Electrician',                                    'Eknath Baragundi',                      '["+91 76767 35006"]',                        'TAG Engineers & Contractors',                          1,  NOW(), NOW()),
    ('cnt-mo-02', villa_mo_id, 'Plumber',                                        'Shantanu',                              '["+91 96048 00926"]',                        'TAG Engineers & Contractors',                          2,  NOW(), NOW()),
    ('cnt-mo-03', villa_mo_id, 'HVAC',                                           'Manoj Sharma',                          '["+91 98238 66071","+91 74981 45368"]',      'Aermech (Daikin)',                                     3,  NOW(), NOW()),
    ('cnt-mo-04', villa_mo_id, 'Solar Water Heater',                             'Suhas Shetkar',                         '["+91 83909 87181"]',                        'Sansri Enterprises',                                   4,  NOW(), NOW()),
    ('cnt-mo-05', villa_mo_id, 'Swimming Pool Filter',                           'Swapnil Naik',                          '["+91 98812 28592"]',                        NULL,                                                   5,  NOW(), NOW()),
    ('cnt-mo-06', villa_mo_id, 'Landscape',                                      'Mohan Thulasi',                         '["+91 85534 23223"]',                        'Shri Balaji Ganga Bhavani Seedling Supplier',          6,  NOW(), NOW()),
    ('cnt-mo-07', villa_mo_id, 'Miscellaneous (Carpenter/Fabricator)',           'Manoj Vishwakarma',                     '["+91 88983 39395"]',                        'TAG Engineers & Contractors',                          7,  NOW(), NOW()),
    ('cnt-mo-08', villa_mo_id, 'WiFi Connection',                                'Parimal Shukla',                        '["+91 95299 19829"]',                        'Ethernet Express',                                     8,  NOW(), NOW()),
    ('cnt-mo-09', villa_mo_id, 'Automation',                                     'Kedar Tandel',                          '["+91 86551 55332"]',                        'Technet (Mumbai)',                                     9,  NOW(), NOW()),
    ('cnt-mo-10', villa_mo_id, 'UPS, Battery & Stabiliser',                      'Milind Choudhari',                      '["+91 92250 74577"]',                        'Powersafe Engineers',                                  10, NOW(), NOW()),
    ('cnt-mo-11', villa_mo_id, 'Kitchen - Electric Oven, Hob & Chimney',         'Mann Chothani / Adi Dhargalkar',         '["+91 95299 97308","+91 97641 05860"]',      'Kaff',                                                 11, NOW(), NOW()),
    ('cnt-mo-12', villa_mo_id, 'Kitchen - Built-in Refrigerator & Dishwasher',   'Darshan Kandolkar / Priti Singh',       '["+91 95526 11626"]',                        'Carysil',                                              12, NOW(), NOW()),
    ('cnt-mo-13', villa_mo_id, 'Kitchen - Washing Machine',                      'Priti Singh',                           '["+91 88501 76365"]',                        'LG',                                                   13, NOW(), NOW()),
    ('cnt-mo-14', villa_mo_id, 'Kitchen - Refrigerator',                         'Priti Singh',                           '["+91 88501 76365"]',                        'Samsung',                                              14, NOW(), NOW()),
    ('cnt-mo-15', villa_mo_id, 'Kitchen - Water Filter',                         'Priti Singh',                           '["+91 88501 76365"]',                        'ZeroB',                                                15, NOW(), NOW()),
    ('cnt-mo-16', villa_mo_id, 'Kitchen - Microwave Oven',                       'Helpline',                              '["+91 92310 04321","+91 90281 29977"]',      'IFB',                                                  16, NOW(), NOW()),
    ('cnt-mo-17', villa_mo_id, 'Kitchen - Gas Cylinder',                         'HP Gas near Siolim Church',             '[]',                                         'HP Gas',                                               17, NOW(), NOW()),
    ('cnt-mo-18', villa_mo_id, 'Society Manager',                                NULL,                                    '[]',                                         'Casa Aurea',                                           18, NOW(), NOW()),
    ('cnt-mo-19', villa_mo_id, 'Carpenter',                                      'Bhom Singh (locks and more)',           '["+91 80007 50529"]',                        'Freelance',                                            19, NOW(), NOW()),
    ('cnt-mo-20', villa_mo_id, 'Roof Tiles',                                     'Shubham Todkar',                        '["+91 78877 21111"]',                        'Casa Aurea',                                           20, NOW(), NOW()),
    ('cnt-mo-21', villa_mo_id, 'MVR Homes Builder CRM',                          'Devidas Shetkar',                       '["+91 92090 04343"]',                        'Casa Aurea',                                           21, NOW(), NOW())
  ON CONFLICT ("id") DO NOTHING;

END $$;
