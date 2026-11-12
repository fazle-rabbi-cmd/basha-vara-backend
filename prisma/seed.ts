import pkg from '@prisma/client';
const { PrismaClient, AmenityCategory } = pkg;

const prisma = new PrismaClient({
  log: ['query', 'error'],
});

async function main() {
  console.log('🌱 Starting database seed for Basha Vara (system data only)...');

  // Test connection
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }

  // Seed Amenities (system data, not mock data)
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

  for (const item of amenitiesData) {
    const existing = await prisma.amenity.findUnique({
      where: { slug: item.slug },
    });

    if (!existing) {
      await prisma.amenity.create({
        data: item,
      });
    }
  }
  console.log(`✅ Seeded ${amenitiesData.length} amenities.`);
  console.log('🎉 System data seeding completed!');
  console.log('ℹ️  Note: Run seed-permissions.ts to seed roles and permissions.');
  console.log('ℹ️  Note: Run bootstrap-admin.ts to create admin account when needed.');
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
