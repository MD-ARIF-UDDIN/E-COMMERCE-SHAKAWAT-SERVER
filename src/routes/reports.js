const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');

async function reportRoutes(fastify, options) {
  // GET /api/reports/dashboard
  fastify.get('/dashboard', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    
    // 1. Overall Sales (Delivered Orders)
    const overall = await prisma.order.aggregate({
      where: { status: 'Delivered' },
      _sum: { totalAmount: true },
      _count: { id: true }
    });

    // 2. Sales by Month
    // Note: Prisma groupBy doesn't support date formatting easily in all DBs.
    // We'll fetch and aggregate in JS for simplicity and consistency.
    const deliveredOrders = await prisma.order.findMany({
      where: { status: 'Delivered' },
      select: { createdAt: true, totalAmount: true }
    });

    const salesByMonthMap = {};
    deliveredOrders.forEach(order => {
      const month = order.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!salesByMonthMap[month]) salesByMonthMap[month] = { revenue: 0, orders: 0 };
      salesByMonthMap[month].revenue += order.totalAmount;
      salesByMonthMap[month].orders += 1;
    });

    const salesByMonth = Object.entries(salesByMonthMap)
      .map(([month, data]) => ({ _id: month, ...data }))
      .sort((a, b) => a._id.localeCompare(b._id));

    // 3. Sales by Category & Product
    // Fetch order items for delivered orders
    const orderItems = await prisma.orderItem.findMany({
      where: { order: { status: 'Delivered' } },
      include: {
        product: {
          include: { category: true }
        }
      }
    });

    const salesByCategoryMap = {};
    const salesByProductMap = {};

    orderItems.forEach(item => {
      const categoryName = item.product.category?.name || 'Uncategorized';
      const productName = item.product.name;
      const sales = item.price * item.quantity;

      // Category aggregation
      if (!salesByCategoryMap[categoryName]) salesByCategoryMap[categoryName] = { totalSales: 0, totalQuantity: 0 };
      salesByCategoryMap[categoryName].totalSales += sales;
      salesByCategoryMap[categoryName].totalQuantity += item.quantity;

      // Product aggregation
      if (!salesByProductMap[productName]) salesByProductMap[productName] = { totalSales: 0, totalQuantity: 0 };
      salesByProductMap[productName].totalSales += sales;
      salesByProductMap[productName].totalQuantity += item.quantity;
    });

    const salesByCategory = Object.entries(salesByCategoryMap)
      .map(([name, data]) => ({ category: name, sales: data.totalSales, quantity: data.totalQuantity }))
      .sort((a, b) => b.sales - a.sales);

    const salesByProduct = Object.entries(salesByProductMap)
      .map(([name, data]) => ({ product: name, sales: data.totalSales, quantity: data.totalQuantity }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // 4. Purchase Report
    const purchases = await prisma.purchase.findMany();
    const purchaseReportMap = {};
    purchases.forEach(p => {
      const month = p.date.toISOString().substring(0, 7);
      if (!purchaseReportMap[month]) purchaseReportMap[month] = { totalCost: 0, totalQuantity: 0 };
      purchaseReportMap[month].totalCost += p.costPrice * p.quantity;
      purchaseReportMap[month].totalQuantity += p.quantity;
    });

    const purchaseReport = Object.entries(purchaseReportMap)
      .map(([month, data]) => ({ month, cost: data.totalCost, quantity: data.totalQuantity }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 5. Inventory Snapshot
    const products = await prisma.product.findMany({
      include: { category: true }
    });

    const inventorySnapshotMap = {};
    products.forEach(p => {
      const categoryName = p.category?.name || 'Uncategorized';
      if (!inventorySnapshotMap[categoryName]) inventorySnapshotMap[categoryName] = { totalStock: 0 };
      inventorySnapshotMap[categoryName].totalStock += p.stock;
    });

    const inventorySnapshot = Object.entries(inventorySnapshotMap)
      .map(([name, data]) => ({ category: name, stock: data.totalStock }))
      .sort((a, b) => b.stock - a.stock);

    return {
      overall: {
        totalRevenue: overall._sum.totalAmount || 0,
        totalOrders: overall._count.id || 0
      },
      salesByMonth,
      salesByCategory,
      salesByProduct,
      purchaseReport,
      inventorySnapshot
    };
  });
}

module.exports = reportRoutes;
