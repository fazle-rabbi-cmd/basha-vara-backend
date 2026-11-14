import { faker } from '@faker-js/faker';

// Test user fixtures
export const testUsers = {
  tenant: {
    id: faker.string.uuid(),
    email: 'tenant@test.com',
    password: 'password123',
    fullName: 'Test Tenant',
    phone: '+8801712345678',
    role: 'TENANT',
    status: 'ACTIVE',
  },
  landlord: {
    id: faker.string.uuid(),
    email: 'landlord@test.com',
    password: 'password123',
    fullName: 'Test Landlord',
    phone: '+8801812345678',
    role: 'LANDLORD',
    status: 'ACTIVE',
  },
  admin: {
    id: faker.string.uuid(),
    email: 'admin@test.com',
    password: 'password123',
    fullName: 'Test Admin',
    phone: '+8801912345678',
    role: 'ADMIN',
    status: 'ACTIVE',
  },
  moderator: {
    id: faker.string.uuid(),
    email: 'moderator@test.com',
    password: 'password123',
    fullName: 'Test Moderator',
    phone: '+8802012345678',
    role: 'MODERATOR',
    status: 'ACTIVE',
  },
};

// Test property fixtures
export const testProperties = {
  apartment: {
    id: faker.string.uuid(),
    title: 'Test Apartment',
    description: 'A test apartment for testing purposes',
    propertyType: 'APARTMENT',
    rentAmount: 25000,
    depositAmount: 50000,
    bedrooms: 2,
    bathrooms: 2,
    areaSqft: 1200,
    floor: 3,
    totalFloors: 10,
    addressLine: '123 Test Street',
    area: 'Dhanmondi',
    city: 'Dhaka',
    district: 'Dhaka',
    availableFrom: new Date('2024-01-01'),
    status: 'PUBLISHED',
    lat: 23.7461,
    lng: 90.3742,
  },
  house: {
    id: faker.string.uuid(),
    title: 'Test House',
    description: 'A test house for testing purposes',
    propertyType: 'HOUSE',
    rentAmount: 35000,
    depositAmount: 70000,
    bedrooms: 3,
    bathrooms: 3,
    areaSqft: 2000,
    floor: 1,
    totalFloors: 2,
    addressLine: '456 Test Avenue',
    area: 'Gulshan',
    city: 'Dhaka',
    district: 'Dhaka',
    availableFrom: new Date('2024-01-01'),
    status: 'PUBLISHED',
    lat: 23.7808,
    lng: 90.4074,
  },
};

// Test visit fixtures
export const testVisits = {
  pending: {
    id: faker.string.uuid(),
    requestedDate: new Date('2024-12-01'),
    requestedTime: '10:00',
    status: 'PENDING',
    visitType: 'IN_PERSON',
    guestCount: 1,
  },
  accepted: {
    id: faker.string.uuid(),
    requestedDate: new Date('2024-12-01'),
    requestedTime: '10:00',
    status: 'ACCEPTED',
    visitType: 'IN_PERSON',
    guestCount: 1,
    landlordOtp: '123456',
    tenantOtp: '654321',
  },
};

// Test application fixtures
export const testApplications = {
  submitted: {
    id: faker.string.uuid(),
    coverNote: 'I am interested in this property',
    moveInDate: new Date('2024-12-15'),
    proposedRent: 24000,
    status: 'SUBMITTED',
  },
  selected: {
    id: faker.string.uuid(),
    coverNote: 'I am very interested in this property',
    moveInDate: new Date('2024-12-15'),
    proposedRent: 24000,
    status: 'SELECTED',
  },
};

// Test payment fixtures
export const testPayments = {
  tokenPayment: {
    id: faker.string.uuid(),
    amount: 5000,
    paymentType: 'TOKEN',
    status: 'PENDING',
    paymentMethod: 'CARD',
  },
  rentPayment: {
    id: faker.string.uuid(),
    amount: 25000,
    paymentType: 'RENT',
    status: 'COMPLETED',
    paymentMethod: 'BANK_TRANSFER',
    transactionId: 'TXN123456',
  },
};

// Test notification fixtures
export const testNotifications = {
  visitRequest: {
    id: faker.string.uuid(),
    type: 'VISIT_REQUESTED',
    title: 'New Visit Request',
    message: 'A tenant has requested to visit your property',
    isRead: false,
  },
  applicationSubmitted: {
    id: faker.string.uuid(),
    type: 'APPLICATION_SUBMITTED',
    title: 'New Application',
    message: 'A tenant has applied for your property',
    isRead: false,
  },
};

// Test lease fixtures
export const testLeases = {
  active: {
    id: faker.string.uuid(),
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    rentAmount: 25000,
    depositAmount: 50000,
    status: 'ACTIVE',
    terms: 'Standard lease terms',
  },
};

// Test escrow fixtures
export const testEscrows = {
  held: {
    id: faker.string.uuid(),
    amount: 25000,
    status: 'HELD',
    holdReason: 'Rent payment',
  },
  released: {
    id: faker.string.uuid(),
    amount: 25000,
    status: 'RELEASED',
    holdReason: 'Rent payment',
    releasedAt: new Date(),
  },
};
