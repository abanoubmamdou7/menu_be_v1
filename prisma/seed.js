// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// async function main() {
//   // ✅ Create Bucket table data
//   await prisma.bucket.create({
//     data: {
//       name: "menu",
//       public: true,
//       file_size_limit: 5242880n,
//     },
//   });


//   console.log('✅ Seeding done!');
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const exists = await prisma.bucket.findFirst({
    where: { name: "menu" },
  });

  if (!exists) {
    await prisma.bucket.create({
      data: {
        name: "menu",
        public: true,
        file_size_limit: BigInt(5242880), // ✅ safer BigInt
      },
    });
    console.log("✅ Bucket created!");
  } else {
    console.log("⚡ Bucket already exists, skipping.");
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
