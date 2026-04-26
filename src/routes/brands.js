const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function brandRoutes(fastify, options) {
  // Public
  fastify.get('/', async (request, reply) => {
    const { category } = request.query;
    
    let where = {};
    if (category) {
      where = {
        products: { some: { categoryId: category } }
      };
    }

    return await prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' }
    });
  });

  fastify.get('/sub-brands', async (request, reply) => {
    return await prisma.subBrand.findMany({
      include: { brand: true },
      orderBy: { name: 'asc' }
    });
  });

  // Admin
  fastify.post('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const brand = await prisma.brand.create({
        data: request.body
      });
      return reply.code(201).send(brand);
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to create brand' });
    }
  });

  fastify.post('/sub-brands', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const { name, slug, brand } = request.body;
      const subBrand = await prisma.subBrand.create({
        data: {
          name,
          slug,
          brandId: brand
        }
      });
      return reply.code(201).send(subBrand);
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to create sub-brand: ' + error.message });
    }
  });
}

module.exports = brandRoutes;
