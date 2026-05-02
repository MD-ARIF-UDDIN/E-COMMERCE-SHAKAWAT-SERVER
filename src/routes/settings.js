const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function settingsRoutes(fastify, options) {
  // Public - Get delivery charges
  fastify.get('/', async (request, reply) => {
    try {
      let settings = await prisma.settings.findUnique({
        where: { id: 'global' }
      });

      if (!settings) {
        // Initialize default settings if not exists
        settings = await prisma.settings.create({
          data: {
            id: 'global',
            insideChittagong: 60,
            outsideChittagong: 120,
            businessName: 'Bronze Mart'
          }
        });
      }
      return settings;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch settings' });
    }
  });

  // Admin - Update settings
  fastify.put('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    const { insideChittagong, outsideChittagong, businessName, contactPhone, contactEmail } = request.body;
    
    try {
      const settings = await prisma.settings.upsert({
        where: { id: 'global' },
        update: {
          insideChittagong: parseFloat(insideChittagong),
          outsideChittagong: parseFloat(outsideChittagong),
          businessName,
          contactPhone,
          contactEmail
        },
        create: {
          id: 'global',
          insideChittagong: parseFloat(insideChittagong) || 60,
          outsideChittagong: parseFloat(outsideChittagong) || 120,
          businessName: businessName || 'Bronze Mart',
          contactPhone,
          contactEmail
        }
      });
      return settings;
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to update settings' });
    }
  });
}

module.exports = settingsRoutes;
