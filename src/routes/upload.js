const { uploadProductImage } = require('../utils/upload');
const { requireRole } = require('../middlewares/auth');

async function uploadRoutes(fastify, options) {
  // POST /api/upload - General purpose upload (defaults to products bucket)
  fastify.post('/', { 
    preHandler: [requireRole(['SuperAdmin', 'Admin'])] 
  }, async (request, reply) => {
    try {
      const parts = request.parts();
      let urls = [];

      for await (const part of parts) {
        if (part.file) {
          const buffer = await part.toBuffer();
          const url = await uploadProductImage(buffer, part.filename);
          urls.push(url);
        }
      }

      if (urls.length === 0) {
        return reply.code(400).send({ error: 'No files uploaded' });
      }

      return { urls };
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Upload failed: ' + error.message });
    }
  });
}

module.exports = uploadRoutes;
