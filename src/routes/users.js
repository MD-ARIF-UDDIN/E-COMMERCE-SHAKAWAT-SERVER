const prisma = require('../config/prisma');
const supabase = require('../config/supabase');
const { requireRole } = require('../middlewares/auth');

async function userRoutes(fastify, options) {
  // Admin - Get all users
  fastify.get('/', { preHandler: [requireRole(['SuperAdmin'])] }, async (request, reply) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return users;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ error: 'Failed to fetch users' });
    }
  });

  // Admin - Create user
  fastify.post('/', { preHandler: [requireRole(['SuperAdmin'])] }, async (request, reply) => {
    const { email, password, name, role } = request.body;

    if (!email || !password || !name) {
      return reply.code(400).send({ error: 'Email, password and name are required' });
    }

    try {
      // 1. Create user in Supabase using Admin API (bypasses email confirmation)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });

      if (authError) {
        return reply.code(400).send({ error: authError.message });
      }

      // 2. Create profile in Prisma
      const user = await prisma.user.create({
        data: {
          id: authData.user.id,
          name,
          email,
          password: 'SUPABASE_AUTH',
          role: role || 'Employee'
        }
      });

      return reply.code(201).send(user);
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to create user' });
    }
  });

  // Admin - Delete user
  fastify.delete('/:id', { preHandler: [requireRole(['SuperAdmin'])] }, async (request, reply) => {
    const { id } = request.params;

    try {
      // 1. Delete from Supabase Auth
      const { error: authError } = await supabase.auth.admin.deleteUser(id);
      
      if (authError && !authError.message.includes('not found')) {
        return reply.code(400).send({ error: authError.message });
      }

      // 2. Delete from Prisma
      await prisma.user.delete({ where: { id } });

      return { message: 'User deleted successfully' };
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to delete user' });
    }
  });
}

module.exports = userRoutes;
