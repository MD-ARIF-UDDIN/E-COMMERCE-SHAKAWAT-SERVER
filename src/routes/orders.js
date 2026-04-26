const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');
const { generateOrderNumber } = require('../utils/orderNumber');

async function orderRoutes(fastify, options) {
  // Public - Create Order (Checkout) - no auth required
  fastify.post('/', async (request, reply) => {
    const { customerPhone, customerName, address, items, totalAmount, paymentMethod } = request.body;

    if (!customerPhone) return reply.code(400).send({ error: 'Phone number is required' });
    if (!address) return reply.code(400).send({ error: 'Delivery address is required' });
    if (!items || items.length === 0) return reply.code(400).send({ error: 'Cart is empty' });

    // Spam check
    const isSpam = await prisma.spam.findUnique({ where: { phoneNumber: customerPhone } });
    if (isSpam) {
      return reply.code(403).send({ error: 'This phone number has been blocked. Contact support.' });
    }

    // Generate unique order number (retry if collision)
    let orderNumber;
    let attempts = 0;
    while (attempts < 5) {
      orderNumber = generateOrderNumber();
      const exists = await prisma.order.findUnique({ where: { orderNumber } });
      if (!exists) break;
      attempts++;
    }

    try {
      const order = await prisma.order.create({
        data: {
          orderNumber,
          customerPhone,
          customerName,
          address,
          totalAmount,
          paymentMethod: paymentMethod || 'COD',
          items: {
            create: items.map(item => ({
              productId: item.product,
              quantity: item.quantity,
              price: item.price,
              color: item.color,
              colorName: item.colorName
            }))
          }
        },
        include: {
          items: true
        }
      });
      return reply.code(201).send(order);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to create order' });
    }
  });

  // Public - Track Order
  fastify.get('/track', async (request, reply) => {
    const { orderNumber, phone } = request.query;

    if (!orderNumber || !phone) {
      return reply.code(400).send({ error: 'Order number and phone number are required' });
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber, customerPhone: phone },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, images: true, price: true }
            }
          }
        }
      }
    });

    if (!order) {
      return reply.code(404).send({ error: 'Order not found. Please check your order number and phone number.' });
    }

    return order;
  });

  // Admin - Get all orders
  fastify.get('/admin', { preHandler: [requireRole(['SuperAdmin', 'Admin', 'Employee'])] }, async (request, reply) => {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: { select: { name: true, images: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return orders;
  });

  // Admin - Update Order Status
  fastify.put('/admin/:id/status', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    const { status, deliveryCompany } = request.body;

    try {
      const existingOrder = await prisma.order.findUnique({
        where: { id: request.params.id },
        include: { items: true }
      });

      if (!existingOrder) return reply.code(404).send({ error: 'Order not found' });

      // On Delivered: decrease stock and log OUT
      if (status === 'Delivered' && existingOrder.status !== 'Delivered') {
        await prisma.$transaction(async (tx) => {
          for (const item of existingOrder.items) {
            if (item.color) {
               // Decrease from ColorVariant
               await tx.colorVariant.update({
                 where: { id: item.color },
                 data: { stock: { decrement: item.quantity } }
               });
            } else {
               // Decrease from Product
               await tx.product.update({
                 where: { id: item.productId },
                 data: { stock: { decrement: item.quantity } }
               });
            }
            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                type: 'OUT',
                quantity: item.quantity,
                reason: `Order Delivered: ${existingOrder.orderNumber}`,
                referenceId: existingOrder.id,
              }
            });
          }
          await tx.order.update({
            where: { id: request.params.id },
            data: { 
              status,
              deliveryCompany: deliveryCompany !== undefined ? deliveryCompany : undefined
            }
          });
        });
        return await prisma.order.findUnique({ where: { id: request.params.id } });
      }

      const updatedOrder = await prisma.order.update({
        where: { id: request.params.id },
        data: { 
          status,
          deliveryCompany: deliveryCompany !== undefined ? deliveryCompany : undefined
        }
      });
      return updatedOrder;
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to update order status' });
    }
  });
}

module.exports = orderRoutes;
