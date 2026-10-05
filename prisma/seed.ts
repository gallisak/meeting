import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Cleaning the database");
    
    await prisma.booking.deleteMany();
    await prisma.room.deleteMany();
    await prisma.equipment.deleteMany();
    await prisma.user.deleteMany();

    console.log("Creating an administrator");

    await prisma.user.create({
        data: {
            email: 'admin@booking.com',
            passwordHash: 'temporaryHashForAdminSeedOnly',
            name: 'System Admin',
            role: Role.ADMIN
        }
    });

    console.log('Equipment manufacturing');
  const projector = await prisma.equipment.create({
    data: { name: 'projector' },
  });

  const whiteboard = await prisma.equipment.create({
    data: { name: 'Whiteboard' },
  });

  const videoConference = await prisma.equipment.create({
    data: { name: 'Video camera' },
  });

  console.log('Creating test rooms');
  await prisma.room.create({
    data: {
      name: 'Large meeting room',
      capacity: 12,
      floor: 3,
      isActive: true,
      equipments: {
        connect: [{ id: projector.id }, { id: videoConference.id }],
      },
    },
  });

  await prisma.room.create({
    data: {
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
    console.error("Seed execution error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });