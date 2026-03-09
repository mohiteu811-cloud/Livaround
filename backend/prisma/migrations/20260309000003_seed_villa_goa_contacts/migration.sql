-- Seed property contacts for Villa Sussegad (prop-villa-goa)
-- Contact list provided by architect/contractor

INSERT INTO "PropertyContact" ("id","propertyId","agency","name","phones","company","order","createdAt","updatedAt") VALUES
('cnt-villa-01','prop-villa-goa','Electrician','Eknath Baragundi','["+91 76767 35006"]','TAG Engineers & Contractors',1,NOW(),NOW()),
('cnt-villa-02','prop-villa-goa','Plumber','Shantanu','["+91 96048 00926"]','TAG Engineers & Contractors',2,NOW(),NOW()),
('cnt-villa-03','prop-villa-goa','HVAC','Manoj Sharma','["+91 98238 66071","+91 74981 45368"]','Aermech (Daikin)',3,NOW(),NOW()),
('cnt-villa-04','prop-villa-goa','Solar Water Heater','Suhas Shetkar','["+91 83909 87181"]','Sansri Enterprises',4,NOW(),NOW()),
('cnt-villa-05','prop-villa-goa','Swimming Pool Filter','Swapnil Naik','["+91 98812 28592"]',NULL,5,NOW(),NOW()),
('cnt-villa-06','prop-villa-goa','Landscape','Mohan Thulasi','["+91 85534 23223"]','Shri Balaji Ganga Bhavani Seedling Supplier',6,NOW(),NOW()),
('cnt-villa-07','prop-villa-goa','Carpenter / Fabricator (Misc)','Manoj Vishwakarma','["+91 88983 39395"]','TAG Engineers & Contractors',7,NOW(),NOW()),
('cnt-villa-08','prop-villa-goa','WiFi Connection','Parimal Shukla','["+91 95299 19829"]','Ethernet Express',8,NOW(),NOW()),
('cnt-villa-09','prop-villa-goa','Automation','Kedar Tandel','["+91 86551 55332"]','Technet (Mumbai)',9,NOW(),NOW()),
('cnt-villa-10','prop-villa-goa','UPS, Battery & Stabiliser','Milind Choudhari','["+91 92250 74577"]','Powersafe Engineers',10,NOW(),NOW()),
('cnt-villa-11','prop-villa-goa','Electric Oven, Hob & Chimney','Mann Chothani / Adi Dhargalkar','["+91 95299 97308","+91 97641 05860"]','Kaff',11,NOW(),NOW()),
('cnt-villa-12','prop-villa-goa','Built-in Refrigerator & Dishwasher','Darshan Kandolkar / Priti Singh','["+91 95526 11626"]','Carysil',12,NOW(),NOW()),
('cnt-villa-13','prop-villa-goa','Washing Machine','Priti Singh','["+91 88501 76365"]','LG',13,NOW(),NOW()),
('cnt-villa-14','prop-villa-goa','Refrigerator','Priti Singh','["+91 88501 76365"]','Samsung',14,NOW(),NOW()),
('cnt-villa-15','prop-villa-goa','Water Filter','Priti Singh','["+91 88501 76365"]','ZeroB',15,NOW(),NOW()),
('cnt-villa-16','prop-villa-goa','Microwave Oven','Helpline','["+91 92310 04321","+91 90281 29977"]','IFB',16,NOW(),NOW()),
('cnt-villa-17','prop-villa-goa','Gas Cylinder','HP Gas near Siolim Church','[]','HP Gas',17,NOW(),NOW()),
('cnt-villa-18','prop-villa-goa','Society Manager',NULL,'[]','Casa Aurea',18,NOW(),NOW()),
('cnt-villa-19','prop-villa-goa','Carpenter (Locks & Misc)','Bhom Singh','["8000750529"]','Freelance',19,NOW(),NOW()),
('cnt-villa-20','prop-villa-goa','Roof Tiles','Shubham Todkar','["+91 78877 21111"]','Casa Aurea',20,NOW(),NOW()),
('cnt-villa-21','prop-villa-goa','Builder CRM (MVR Homes)','Devidas Shetkar','["+91 92090 04343"]','Casa Aurea',21,NOW(),NOW())
ON CONFLICT ("id") DO NOTHING;
