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
  const { uploadCategoryImage } = require('../utils/upload');

  fastify.post('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const parts = request.parts();
      let data = {};
      let image = null;

      for await (const part of parts) {
        if (part.file) {
          const buffer = await part.toBuffer();
          image = await uploadCategoryImage(buffer, part.filename);
        } else {
          data[part.fieldname] = part.value;
        }
      }

      const category = await prisma.category.create({
        data: { ...data, image }
      });
      return reply.code(201).send(category);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(400).send({ error: 'Failed to create category: ' + error.message });
    }
  });

  fastify.put('/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const parts = request.parts();
      let data = {};
      let image = null;

      for await (const part of parts) {
        if (part.file) {
          const buffer = await part.toBuffer();
          image = await uploadCategoryImage(buffer, part.filename);
        } else {
          data[part.fieldname] = part.value;
        }
      }

      const updateData = { ...data };
      if (image) updateData.image = image;

      const category = await prisma.category.update({
        where: { id: request.params.id },
        data: updateData
      });
      return category;
    } catch (error) {
      fastify.log.error(error);
      return reply.code(404).send({ error: 'Category not found or update failed' });
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
