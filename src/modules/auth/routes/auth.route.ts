import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { loginSchema, registerSchema, verifySchema } from '../schemas/auth.schema.js';
import { registerController } from '../controllers/registerController.js';
import { loginController } from '../controllers/loginController.js';
import { verifyController } from '../controllers/verifyController.js';
import { refreshController } from '../controllers/refreshController.js';
import { logoutController } from '../controllers/logoutController.js';
import { notLoggedMiddleware } from '../middleware/notLogged.middleware.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware } from '../../../lib/rateLimit.middleware.js';
import { meController } from '../controllers/meController.js';

export async function authRoutes(app: FastifyInstance) {
  //to zod type bodies
  const router = app.withTypeProvider<ZodTypeProvider>();

  router.post(
    '/register',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: registerSchema, tags: ['auth'], description: 'Register a new user' },
    },
    registerController,
  );

  router.post(
    '/login',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: loginSchema, tags: ['auth'], description: 'Login and receive access token' },
    },
    loginController,
  );

  router.post(
    '/verify',
    {
      preHandler: [rateLimitMiddleware, notLoggedMiddleware],
      schema: { body: verifySchema, tags: ['auth'], description: 'Verify user email' },
    },
    verifyController,
  );

  router.get('/me', { preHandler: authMiddleware, schema: { tags: ['auth'], description: 'Get current user information' } }, meController);

  router.post('/refresh', { preHandler: [rateLimitMiddleware], schema: { tags: ['auth'], description: 'Refresh access token' } }, refreshController);
  router.post('/logout', { preHandler: authMiddleware, schema: { tags: ['auth'], description: 'Logout user' } }, logoutController);
}
