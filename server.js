require('dotenv').config();
const Fastify = require('fastify');
const cors = require('@fastify/cors');
const jwt = require('@fastify/jwt');
const multipart = require('@fastify/multipart');
const prisma = require('./src/config/prisma');

const server = Fastify({
  logger: true
});

// Register Plugins
server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'ecommerce_secret_key_12345!'
});

server.register(multipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 100,
    fields: 50,
    fileSize: 10000000, // 10MB
    files: 20,
  }
});

const { mapId } = require('./src/utils/idMapper');
server.addHook('preSerialization', async (request, reply, payload) => {
  return mapId(payload);
});

// Database connection check
const connectDB = async () => {
  try {
    await prisma.$connect();
    server.log.info('PostgreSQL (Prisma) connected successfully');

    // Auto-seed SuperAdmin
    const adminEmail = 'arif@gmail.com';
    const adminPassword = '123456';
    const supabase = require('./src/config/supabase');

    // 1. Check/Sync Supabase Auth
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    let authUser = users?.find(u => u.email === adminEmail);

    if (!authUser) {
      server.log.info(`Creating SuperAdmin in Supabase Auth...`);
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true
      });
      if (authError) {
        server.log.error('Failed to create SuperAdmin in Supabase Auth:', authError.message);
      } else {
        authUser = newAuthUser.user;
      }
    } else {
      // User exists in Auth, ensure password is set to 123456
      await supabase.auth.admin.updateUserById(authUser.id, { password: adminPassword });
    }

    // 2. Check/Sync Prisma Profile
    if (authUser) {
      const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (!existingAdmin) {
        await prisma.user.create({
          data: {
            id: authUser.id,
            name: 'Arif SuperAdmin',
            email: adminEmail,
            password: 'SUPABASE_AUTH',
            role: 'SuperAdmin'
          }
        });
        server.log.info(`SuperAdmin profile created in Prisma: ${adminEmail}`);
      } else if (existingAdmin.id !== authUser.id) {
        // IDs don't match, sync Prisma ID to Auth ID
        await prisma.user.update({
          where: { email: adminEmail },
          data: { id: authUser.id }
        });
        server.log.info(`SuperAdmin Prisma ID synced to Supabase Auth ID.`);
      }
    }
  } catch (error) {
    server.log.error('Database connection error:', error);
    process.exit(1);
  }
};

// Start Server
const start = async () => {
  try {
    await connectDB();

    // Register Routes
    server.register(require('./src/routes/auth'), { prefix: '/api/auth' });
    server.register(require('./src/routes/products'), { prefix: '/api/products' });
    server.register(require('./src/routes/categories'), { prefix: '/api/categories' });
    server.register(require('./src/routes/brands'), { prefix: '/api/brands' });
    server.register(require('./src/routes/orders'), { prefix: '/api/orders' });
    server.register(require('./src/routes/inventory'), { prefix: '/api/admin/inventory' });
    server.register(require('./src/routes/spam'), { prefix: '/api/admin/spam' });
    server.register(require('./src/routes/settings'), { prefix: '/api/settings' });
    server.register(require('./src/routes/users'), { prefix: '/api/users' });
    server.register(require('./src/routes/upload'), { prefix: '/api/upload' });
    server.register(require('./src/routes/reports'), { prefix: '/api/reports' });
    server.register(require('./src/routes/banners'), { prefix: '/api/banners' });

    server.get('/', async (request, reply) => {
      let settings = await prisma.settings.findUnique({ where: { id: 'global' } });
      if (!settings) settings = { businessName: 'NovaCart' };
      
      const bName = settings.businessName;
      
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${bName} API | System Online</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Plus Jakarta Sans', sans-serif; }
            .dot-pattern {
              background-image: radial-gradient(#e2e8f0 1px, transparent 1px);
              background-size: 24px 24px;
            }
          </style>
        </head>
        <body className="bg-white text-slate-900 min-h-screen flex items-center justify-center p-6 dot-pattern">
          <div className="max-w-md w-full bg-white/80 backdrop-blur-xl border border-slate-200 rounded-[2.5rem] p-12 text-center shadow-2xl">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-indigo-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
            </div>
            <h1 className="text-3xl font-black mb-4 tracking-tight">${bName} API</h1>
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-8">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              System Operational
            </div>
            <p className="text-slate-500 font-medium mb-10 leading-relaxed">
              The backend engine is running on <span className="text-slate-900 font-bold">Fastify + Prisma 7</span>. Ready for commerce.
            </p>
            <div className="flex flex-col gap-3">
              <a href="/health" className="bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all">Check System Health</a>
              <a href="http://localhost:3000" className="text-indigo-600 font-bold hover:underline">Go to Storefront</a>
            </div>
          </div>
        </body>
        </html>
      `);
    });

    server.get('/health', async (request, reply) => {
      return { status: 'ok', message: 'E-commerce API is running', version: '1.0.0-prisma7' };
    });

    await server.listen({ port: process.env.PORT || 5000, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${process.env.PORT || 5000}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
