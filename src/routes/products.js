const prisma = require('../config/prisma');
const { requireRole } = require('../middlewares/auth');
const { mapId } = require('../utils/idMapper');

async function productRoutes(fastify, options) {
  // ─── Public Routes ────────────────────────────────────────────────────────

  // GET /api/products  — list with filters, sorting, search
  fastify.get('/', async (request, reply) => {
    const { category, brand, search, sort, minPrice, maxPrice } = request.query;

    let where = {};
    if (category) where.categoryId = category;
    if (brand) where.brandId = brand;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy = {};
    if (sort === 'price_asc') orderBy.price = 'asc';
    else if (sort === 'price_desc') orderBy.price = 'desc';
    else orderBy.createdAt = 'desc';

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        colorVariants: true,
      }
    });
    return mapId(products);
  });

  // GET /api/products/by-id/:id  — admin fetch by ID
  fastify.get('/by-id/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    const product = await prisma.product.findUnique({
      where: { id: request.params.id },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        subBrand: { select: { name: true, slug: true } },
        colorVariants: true,
      }
    });
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return mapId(product);
  });

  // GET /api/products/:slug  — public product detail by slug
  fastify.get('/:slug', async (request, reply) => {
    const product = await prisma.product.findUnique({
      where: { slug: request.params.slug },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true, slug: true } },
        colorVariants: true,
      }
    });
    if (!product) return reply.code(404).send({ error: 'Product not found' });
    return mapId(product);
  });

  // GET /api/products/:id/reviews
  fastify.get('/:id/reviews', async (request, reply) => {
    const reviews = await prisma.review.findMany({
      where: { productId: request.params.id },
      orderBy: { createdAt: 'desc' }
    });
    return mapId(reviews);
  });

  // POST /api/products/:id/reviews
  fastify.post('/:id/reviews', async (request, reply) => {
    const { name, rating, body } = request.body;
    const review = await prisma.review.create({
      data: {
        productId: request.params.id,
        name,
        rating: parseInt(rating, 10),
        body
      }
    });
    return mapId(review);
  });

  // ─── Admin Routes ─────────────────────────────────────────────────────────
  const { uploadProductImage } = require('../utils/upload');

  // POST /api/products  — create with images
  fastify.post('/', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const parts = request.parts();
      let data = {};
      let images = [];

      for await (const part of parts) {
        if (part.file) {
          const buffer = await part.toBuffer();
          const url = await uploadProductImage(buffer, part.filename);
          images.push(url);
        } else {
          let value = part.value;
          let fieldname = part.fieldname;

          // Map frontend names to Prisma names
          if (fieldname === 'category') fieldname = 'categoryId';
          if (fieldname === 'brand') fieldname = 'brandId';
          if (fieldname === 'subBrand') fieldname = 'subBrandId';

          if (['price', 'discountPrice', 'stock'].includes(fieldname)) {
            value = parseFloat(value);
            if (isNaN(value)) {
              if (fieldname === 'discountPrice') value = null;
              else continue;
            }
          } else if (['isFeatured', 'isDiscounted', 'hasColors'].includes(fieldname)) {
            value = value === 'true';
          } else if (value === '' && ['brandId', 'subBrandId', 'discountPrice', 'description'].includes(fieldname)) {
            value = null;
          } else if (fieldname === 'colorVariants') {
             try {
               value = JSON.parse(value);
             } catch (e) {
               value = [];
             }
          }
          data[fieldname] = value;
        }
      }

      const validFields = ['name', 'slug', 'categoryId', 'brandId', 'subBrandId', 'price', 'discountPrice', 'stock', 'description', 'isFeatured', 'isDiscounted', 'hasColors'];
      const sanitizedData = {};
      validFields.forEach(f => {
        if (data[f] !== undefined) sanitizedData[f] = data[f];
      });

      const createData = { ...sanitizedData, images };
      
      if (data.hasColors && data.colorVariants && Array.isArray(data.colorVariants)) {
         createData.colorVariants = {
            create: data.colorVariants.map(cv => ({
               name: cv.name,
               hexCode: cv.hexCode,
               stock: parseInt(cv.stock) || 0
            }))
         };
      }

      const product = await prisma.product.create({
        data: createData,
        include: { colorVariants: true }
      });
      
      return reply.code(201).send(mapId(product));
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to create product: ' + error.message });
    }
  });

  // PUT /api/products/:id  — update with images
  fastify.put('/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      const parts = request.parts();
      let data = {};
      let newImages = [];
      let existingImages = [];

      for await (const part of parts) {
        if (part.file) {
          const buffer = await part.toBuffer();
          const url = await uploadProductImage(buffer, part.filename);
          newImages.push(url);
        } else {
          if (part.fieldname === 'existingImages') {
            existingImages = JSON.parse(part.value);
          } else {
            let value = part.value;
            let fieldname = part.fieldname;

            if (fieldname === 'category') fieldname = 'categoryId';
            if (fieldname === 'brand') fieldname = 'brandId';
            if (fieldname === 'subBrand') fieldname = 'subBrandId';

            if (['price', 'discountPrice', 'stock'].includes(fieldname)) {
              value = parseFloat(value);
              if (isNaN(value)) {
                if (fieldname === 'discountPrice') value = null;
                else continue;
              }
            } else if (['isFeatured', 'isDiscounted', 'hasColors'].includes(fieldname)) {
              value = value === 'true';
            } else if (value === '' && ['brandId', 'subBrandId', 'discountPrice', 'description'].includes(fieldname)) {
              value = null;
            } else if (fieldname === 'colorVariants') {
               try {
                 value = JSON.parse(value);
               } catch (e) {
                 value = [];
               }
            }
            data[fieldname] = value;
          }
        }
      }

      const validFields = ['name', 'slug', 'categoryId', 'brandId', 'subBrandId', 'price', 'discountPrice', 'stock', 'description', 'isFeatured', 'isDiscounted', 'hasColors'];
      const sanitizedData = {};
      validFields.forEach(f => {
        if (data[f] !== undefined) sanitizedData[f] = data[f];
      });

      // Update product basics and recreate color variants if needed
      await prisma.$transaction(async (tx) => {
         if (data.hasColors) {
           await tx.colorVariant.deleteMany({ where: { productId: request.params.id } });
         }
      });

      const updateData = {
          ...sanitizedData,
          images: [...existingImages, ...newImages]
      };
      
      if (data.hasColors && data.colorVariants && Array.isArray(data.colorVariants)) {
         updateData.colorVariants = {
            create: data.colorVariants.map(cv => ({
               name: cv.name,
               hexCode: cv.hexCode,
               stock: parseInt(cv.stock) || 0
            }))
         };
      }

      const product = await prisma.product.update({
        where: { id: request.params.id },
        data: updateData,
        include: { colorVariants: true }
      });
      return mapId(product);
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: 'Product not found or update failed: ' + error.message });
    }
  });

  // DELETE /api/products/:id  — delete by ID
  fastify.delete('/:id', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    try {
      await prisma.product.delete({
        where: { id: request.params.id }
      });
      return { message: 'Product deleted successfully' };
    } catch (error) {
      request.log.error(error);
      return reply.code(404).send({ error: 'Product not found or delete failed' });
    }
  });
}

module.exports = productRoutes;
