const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function settingsRoutes(fastify, options) {
  // Public - Get global settings
  fastify.get('/', async (request, reply) => {
    let settings = await prisma.settings.findFirst();
    if (!settings) {
      settings = { businessName: 'Default Store', contactPhone: '0000', contactEmail: 'info@store.com' };
    }
    return settings;
  });

  // Admin
  fastify.put('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    const existing = await prisma.settings.findFirst();
    
    try {
      if (!existing) {
        return await prisma.settings.create({
          data: request.body
        });
      } else {
        return await prisma.settings.update({
          where: { id: existing.id },
          data: request.body
        });
      }
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to update settings' });
    }
  });
}

module.exports = settingsRoutes;
