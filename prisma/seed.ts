import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD is not set, skipping the administrator',
    );
    return;
  }

  console.log('Creating an administrator');

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'System Admin',
      role: Role.ADMIN,
    },
  });
}

async function main() {
  await seedAdmin();

  console.log('Creating equipment');

  const projector = await prisma.equipment.upsert({
    where: { name: 'projector' },
    update: {},
    create: { name: 'projector' },
  });

  const whiteboard = await prisma.equipment.upsert({
    where: { name: 'Whiteboard' },
    update: {},
    create: { name: 'Whiteboard' },
  });

  const videoCamera = await prisma.equipment.upsert({
    where: { name: 'Video camera' },
    update: {},
    create: { name: 'Video camera' },
  });

  console.log('Creating test rooms');

  await prisma.room.upsert({
    where: { name: 'Large meeting room' },
    update: {},
    create: {
      name: 'Large meeting room',
      capacity: 12,
      floor: 3,
      isActive: true,
      equipments: {
        connect: [{ id: projector.id }, { id: videoCamera.id }],
      },
    },
  });

  await prisma.room.upsert({
    where: { name: 'Small meeting room' },
    update: {},
    create: {
      name: 'Small meeting room',
      capacity: 4,
      floor: 2,
      isActive: true,
      equipments: {
        connect: [{ id: whiteboard.id }],
      },
    },
  });

  console.log('Seed successfully completed');
}

main()
  .catch((error) => {
    console.error('Seed execution error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
