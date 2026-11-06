import { PrismaClient, Role, UserStatus, PropertyType, PropertyStatus, AmenityCategory } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['query', 'error'],
});

async function main() {
  console.log('🌱 Starting database seed for Basha Vara...');
  
  // Test connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }

  // 1. Seed Amenities
  const amenitiesData = [
    { name: 'Air Conditioning', slug: 'air-conditioning', category: AmenityCategory.ESSENTIAL, icon: 'Wind' },
    { name: 'Gas Connection', slug: 'gas-connection', category: AmenityCategory.ESSENTIAL, icon: 'Flame' },
    { name: 'Water Supply (24/7)', slug: 'water-supply', category: AmenityCategory.ESSENTIAL, icon: 'Droplets' },
    { name: 'Electricity (Prepaid)', slug: 'electricity', category: AmenityCategory.ESSENTIAL, icon: 'Zap' },
    { name: 'Security Guard', slug: 'security-guard', category: AmenityCategory.SAFETY, icon: 'Shield' },
    { name: 'CCTV Surveillance', slug: 'cctv', category: AmenityCategory.SAFETY, icon: 'Camera' },
    { name: 'Lift / Elevator', slug: 'lift-elevator', category: AmenityCategory.LUXURY, icon: 'ArrowUpDown' },
    { name: 'Generator Backup', slug: 'generator-backup', category: AmenityCategory.LUXURY, icon: 'BatteryCharging' },
    { name: 'Dedicated Car Parking', slug: 'parking', category: AmenityCategory.UTILITY, icon: 'Car' },
    { name: 'High-Speed Broadband WiFi', slug: 'wifi-internet', category: AmenityCategory.UTILITY, icon: 'Wifi' },
    { name: 'Spacious Balcony', slug: 'balcony', category: AmenityCategory.LUXURY, icon: 'Sun' },
    { name: 'Rooftop Access', slug: 'rooftop-access', category: AmenityCategory.LUXURY, icon: 'Building' },
  ];

  const amenityMap = new Map<string, string>();
  for (const item of amenitiesData) {
    // Check if amenity exists first
    const existing = await prisma.amenity.findUnique({
      where: { slug: item.slug },
    });
    
    let amenity;
    if (existing) {
      amenity = existing;
    } else {
      amenity = await prisma.amenity.create({
        data: item,
      });
    }
    amenityMap.set(item.slug, amenity.id);
  }
  console.log(`✅ Seeded ${amenitiesData.length} amenities.`);

  // 2. Seed Admin User
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@bashavara.com' },
    include: { roles: true },
  });
  
  let admin;
  if (existingAdmin) {
    admin = existingAdmin;
  } else {
    admin = await prisma.user.create({
      data: {
        email: 'admin@bashavara.com',
        fullName: 'Basha Vara Administrator',
        phone: '+8801700000000',
        passwordHash: defaultPasswordHash,
        status: UserStatus.ACTIVE,
        roles: {
          create: [{ role: Role.ADMIN }],
        },
      },
    });
  }
  console.log(`✅ Seeded Admin: ${admin.email}`);

  // 3. Seed Landlord 1 (Rahim Ahmed)
  const existingLandlord1 = await prisma.user.findUnique({
    where: { email: 'landlord1@example.com' },
    include: { landlordProfile: true },
  });
  
  let landlord1;
  if (existingLandlord1) {
    landlord1 = existingLandlord1;
  } else {
    landlord1 = await prisma.user.create({
      data: {
        email: 'landlord1@example.com',
        fullName: 'Rahim Ahmed',
        phone: '+8801712345678',
        passwordHash: defaultPasswordHash,
        status: UserStatus.ACTIVE,
        roles: {
          create: [{ role: Role.LANDLORD }],
        },
        landlordProfile: {
          create: {
            businessName: 'Rahim Properties',
            contactPreference: 'Phone / WhatsApp',
            bio: 'Trusted landlord with 10+ years of rental property experience in Dhanmondi & Mirpur.',
            verified: true,
            responseRate: 98,
          },
        },
      },
    });
  }

  // 4. Seed Tenant 1 (Fatima Begum)
  const existingTenant1 = await prisma.user.findUnique({
    where: { email: 'tenant1@example.com' },
    include: { tenantProfile: true },
  });
  
  let tenant1;
  if (existingTenant1) {
    tenant1 = existingTenant1;
  } else {
    tenant1 = await prisma.user.create({
      data: {
        email: 'tenant1@example.com',
        fullName: 'Fatima Begum',
        phone: '+8801812345678',
        passwordHash: defaultPasswordHash,
        status: UserStatus.ACTIVE,
        roles: {
          create: [{ role: Role.TENANT }],
        },
        tenantProfile: {
          create: {
            occupation: 'Senior Software Engineer',
            householdSize: 4,
            preferredLocations: ['Dhanmondi', 'Mirpur DOHS', 'Lalmatia'],
            budgetMin: 25000,
            budgetMax: 45000,
            bio: 'Looking for a peaceful, well-ventilated family apartment with elevator and generator backup.',
          },
        },
      },
    });
  }
  console.log(`✅ Seeded Landlord & Tenant users.`);

  // 5. Seed Property 1: Dhanmondi Apartment
  const existingProp1 = await prisma.property.findFirst({
    where: { title: 'Modern 3-Bedroom Apartment in Dhanmondi Road 8A' },
  });
  
  let prop1;
  if (!existingProp1) {
    prop1 = await prisma.property.create({
      data: {
        landlordId: landlord1.id,
        title: 'Modern 3-Bedroom Apartment in Dhanmondi Road 8A',
        description: 'Beautiful, south-facing residential apartment with abundant natural daylight, 2 wide balconies, modern open kitchen, and 24/7 security & generator.',
        propertyType: PropertyType.APARTMENT,
        rentAmount: 35000,
        depositAmount: 70000,
        bedrooms: 3,
        bathrooms: 3,
        areaSqft: 1650,
        floor: 4,
        totalFloors: 7,
        addressLine: 'House 42, Road 8A, Dhanmondi',
        area: 'Dhanmondi',
        city: 'Dhaka',
        district: 'Dhaka',
        availableFrom: new Date('2026-11-01'),
        status: PropertyStatus.PUBLISHED,
        photos: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200',
              caption: 'Sunlit Living Room',
              isPrimary: true,
              sortOrder: 1,
            },
            {
              url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
              caption: 'Master Bedroom',
              isPrimary: false,
              sortOrder: 2,
            },
          ],
        },
        amenities: {
          create: [
            { amenityId: amenityMap.get('gas-connection')! },
            { amenityId: amenityMap.get('lift-elevator')! },
            { amenityId: amenityMap.get('generator-backup')! },
            { amenityId: amenityMap.get('security-guard')! },
            { amenityId: amenityMap.get('parking')! },
            { amenityId: amenityMap.get('balcony')! },
          ],
        },
      },
    });
  } else {
    prop1 = existingProp1;
  }

  // 6. Seed Property 2: Mirpur DOHS Flat
  const existingProp2 = await prisma.property.findFirst({
    where: { title: 'Spacious 2-Bedroom Flat in Mirpur DOHS' },
  });
  
  let prop2;
  if (!existingProp2) {
    prop2 = await prisma.property.create({
      data: {
        landlordId: landlord1.id,
        title: 'Spacious 2-Bedroom Flat in Mirpur DOHS',
        description: 'Quiet, highly secured family flat located inside Mirpur DOHS. Ideal for small families or military/corporate officers.',
        propertyType: PropertyType.FLAT,
        rentAmount: 22000,
        depositAmount: 44000,
        bedrooms: 2,
        bathrooms: 2,
        areaSqft: 1150,
        floor: 2,
        totalFloors: 6,
        addressLine: 'Avenue 3, Road 7, Mirpur DOHS',
        area: 'Mirpur DOHS',
        city: 'Dhaka',
        district: 'Dhaka',
        availableFrom: new Date('2026-11-15'),
        status: PropertyStatus.PUBLISHED,
        photos: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200',
              caption: 'Cozy Living Area',
              isPrimary: true,
              sortOrder: 1,
            },
          ],
        },
        amenities: {
          create: [
            { amenityId: amenityMap.get('security-guard')! },
            { amenityId: amenityMap.get('cctv')! },
            { amenityId: amenityMap.get('water-supply')! },
          ],
        },
      },
    });
  } else {
    prop2 = existingProp2;
  }

  console.log(`✅ Seeded Properties: "${prop1.title}", "${prop2.title}".`);
  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  });
