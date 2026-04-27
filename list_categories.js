require('dotenv').config();
const prisma = require('./src/config/prisma');

async function main() {
  const categories = await prisma.category.findMany();
  console.log(JSON.stringify(categories, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
