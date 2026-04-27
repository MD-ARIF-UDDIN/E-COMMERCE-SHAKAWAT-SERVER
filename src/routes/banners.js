const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');
const { mapId } = require('../utils/idMapper');

async function bannerRoutes(fastify, options) {
  // GET /api/banners - Public: get active banners
  fastify.get('/', async (request, reply) => {
    const banners = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });
    return mapId(banners);
  });

  // POST /api/banners - Admin: create banner
  fastify.post('/', { 
    preHandler: [requireRole(['SuperAdmin', 'Admin'])] 
  }, async (request, reply) => {
    const { title, subtitle, description, image, link, order } = request.body;
    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle,
        description,
        image,
        link,
        order: parseInt(order) || 0
      }
    });
    return mapId(banner);
  });

  // PATCH /api/banners/:id - Admin: update banner
  fastify.patch('/:id', { 
    preHandler: [requireRole(['SuperAdmin', 'Admin'])] 
  }, async (request, reply) => {
    const { id } = request.params;
    const banner = await prisma.banner.update({
      where: { id },
      data: request.body
    });
    return mapId(banner);
  });

  // DELETE /api/banners/:id - Admin: delete banner
  fastify.delete('/:id', { 
    preHandler: [requireRole(['SuperAdmin', 'Admin'])] 
  }, async (request, reply) => {
    const { id } = request.params;
    await prisma.banner.delete({ where: { id } });
    return { success: true };
  });
}

module.exports = bannerRoutes;
