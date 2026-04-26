const prisma = require('../config/prisma');
const supabase = require('../config/supabase');

async function authRoutes(fastify, options) {
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;

    // 1. Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      return reply.code(400).send({ error: authError.message });
    }

    // 2. Fetch user profile and role from Prisma
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.code(404).send({ error: 'User profile not found in database' });
    }

    // 3. Generate existing Fastify JWT (to keep middleware compatible)
    const token = fastify.jwt.sign({ 
      id: user.id, 
      role: user.role,
      supabase_uid: authData.user.id 
    });

    return { 
      token, 
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      supabase: { session: authData.session }
    };
  });

  // Register route (Admin only)
  const { requireRole } = require('../middlewares/auth');
  fastify.post('/register', { preHandler: [requireRole(['SuperAdmin', 'Admin'])] }, async (request, reply) => {
    const { email, password, name, role } = request.body;

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password
    });

    if (authError) {
      return reply.code(400).send({ error: authError.message });
    }

    // 2. Create user profile in Prisma
    try {
      const user = await prisma.user.create({
        data: {
          id: authData.user.id, // Link to Supabase Auth UID
          name,
          email,
          password: 'SUPABASE_AUTH', // Password handled by Supabase
          role: role || 'Employee'
        }
      });

      return reply.code(201).send({ 
        message: 'User registered successfully',
        user: { id: user.id, email: user.email, role: user.role }
      });
    } catch (error) {
      request.log.error(error);
      return reply.code(400).send({ error: 'Failed to create user profile' });
    }
  });
}

module.exports = authRoutes;
