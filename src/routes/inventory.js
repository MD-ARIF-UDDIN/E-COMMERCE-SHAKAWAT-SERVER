const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function inventoryRoutes(fastify, options) {
  // Admin only
  fastify.addHook('preHandler', requireRole(['SuperAdmin', 'Admin']));

  // Add Purchase (Stock IN)
  fastify.post('/purchases', async (request, reply) => {
    const { product, quantity, costPrice, supplier } = request.body;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            productId: product,
            quantity,
            costPrice,
            supplier
          }
        });

        // Increase product stock
        await tx.product.update({
          where: { id: product },
          data: { stock: { increment: quantity } }
        });

        // Log Inventory IN
        await tx.inventoryLog.create({
          data: {
            productId: product,
            type: 'IN',
            quantity,
            reason: 'Purchase added',
            referenceId: purchase.id
          }
        });

        return purchase;
      });

      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to record purchase' });
    }
  });

  // Get Purchases
  fastify.get('/purchases', async (request, reply) => {
    return await prisma.purchase.findMany({
      include: { product: { select: { name: true } } },
      orderBy: { date: 'desc' }
    });
  });

  // Get Inventory Logs
  fastify.get('/logs', async (request, reply) => {
    return await prisma.inventoryLog.findMany({
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
  });

  // Manual Stock Adjustment
  fastify.post('/adjust', async (request, reply) => {
    const { product, type, quantity, reason } = request.body;

    if (!['IN', 'OUT'].includes(type)) {
      return reply.code(400).send({ error: 'Type must be IN or OUT' });
    }

    const adjustQty = type === 'IN' ? quantity : -quantity;

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id: product },
          data: { stock: { increment: adjustQty } }
        });

        const log = await tx.inventoryLog.create({
          data: {
            productId: product,
            type,
            quantity,
            reason: reason || 'Manual Adjustment'
          }
        });

        return log;
      });

      return reply.code(201).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to adjust stock' });
    }
  });
}

module.exports = inventoryRoutes;
