const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function spamRoutes(fastify, options) {
  fastify.addHook('preHandler', requireRole(['SuperAdmin', 'Admin']));

  fastify.post('/', async (request, reply) => {
    const { phoneNumber, reason } = request.body;
    
    try {
      const spam = await prisma.spam.create({
        data: { phoneNumber, reason }
      });
      return reply.code(201).send(spam);
    } catch (error) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ error: 'Phone number already blocked' });
      }
      return reply.code(400).send({ error: 'Failed to block phone number' });
    }
  });

  fastify.get('/', async (request, reply) => {
    return await prisma.spam.findMany({
      orderBy: { createdAt: 'desc' }
    });
  });

  fastify.delete('/:id', async (request, reply) => {
    try {
      await prisma.spam.delete({
        where: { id: request.params.id }
      });
      return { message: 'Spam entry deleted' };
    } catch (error) {
      return reply.code(404).send({ error: 'Spam entry not found' });
    }
  });
}

module.exports = spamRoutes;
