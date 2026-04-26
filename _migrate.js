require('dotenv').config();
const prisma = require('./src/config/prisma');

(async () => {
  try {
    // Run raw SQL to add the new columns and table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hasColors" BOOLEAN DEFAULT false;
    `);
    console.log('Added hasColors column to Product');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ColorVariant" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "productId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "hexCode" TEXT NOT NULL,
        "stock" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ColorVariant_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ColorVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('Created ColorVariant table');

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "color" TEXT;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "colorName" TEXT;
    `);
    console.log('Added color/colorName columns to OrderItem');

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Review" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
        "productId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "rating" INTEGER NOT NULL,
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    console.log('Created Review table');

    console.log('Schema migration complete!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
})();
