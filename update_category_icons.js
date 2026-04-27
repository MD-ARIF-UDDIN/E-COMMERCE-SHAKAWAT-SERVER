require('dotenv').config();
const prisma = require('./src/config/prisma');

const categoryIcons = {
  "tech": "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&q=80",
  "food": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80",
  "vivo": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80",
  "electronics": "https://images.unsplash.com/photo-1526733169359-ab1142275435?w=400&q=80",
  "accessories": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
  "beauty": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80",
  "fragrances": "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80",
  "furniture": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80",
  "groceries": "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80",
  "home-decoration": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=400&q=80",
  "kitchen-accessories": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&q=80"
};

async function main() {
  console.log("Updating category icons...");
  
  for (const [slug, url] of Object.entries(categoryIcons)) {
    try {
      const updated = await prisma.category.updateMany({
        where: { slug: slug },
        data: { image: url }
      });
      console.log(`Updated ${slug}: ${updated.count} records`);
    } catch (err) {
      console.error(`Failed to update ${slug}:`, err.message);
    }
  }
  
  console.log("All category icons updated successfully!");
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
