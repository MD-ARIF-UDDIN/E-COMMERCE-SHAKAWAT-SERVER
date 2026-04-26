const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function categoryRoutes(fastify, options) {
  // Public
  fastify.get('/', async (request, reply) => {
    return await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
  });

  // Admin
  fastify.post('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const category = await prisma.category.create({
        data: request.body
      });
      return reply.code(201).send(category);
    } catch (error) {
      return reply.code(400).send({ error: 'Failed to create category' });
    }
  });

  fastify.put('/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const category = await prisma.category.update({
        where: { id: request.params.id },
        data: request.body
      });
      return category;
    } catch (error) {
      return reply.code(404).send({ error: 'Category not found' });
    }
  });

  fastify.delete('/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      await prisma.category.delete({
        where: { id: request.params.id }
      });
      return { message: 'Category deleted' };
    } catch (error) {
      return reply.code(404).send({ error: 'Category not found' });
    }
  });
}

module.exports = categoryRoutes;
