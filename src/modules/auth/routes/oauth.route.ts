import { FastifyInstance } from 'fastify';
import {
  googleRedirectController,
  googleCallbackController,
} from '../controllers/oauth/google/googleCallbackController';
import {
  githubCallbackController,
  githubRedirectController,
} from '../controllers/oauth/github/githubCallbackController';
import { notLoggedMiddleware } from '../middleware/notLogged.middleware';

export async function oauthRoutes(app: FastifyInstance) {
  app.get('/google', { preHandler: notLoggedMiddleware, schema: { tags: ['auth'], description: 'Redirect to Google for authentication' } }, googleRedirectController);
  app.get('/google/callback', { schema: { tags: ['auth'], description: 'Handle Google authentication callback' } }, googleCallbackController);

  app.get('/github', { preHandler: notLoggedMiddleware, schema: { tags: ['auth'], description: 'Redirect to GitHub for authentication' } }, githubRedirectController);
  app.get('/github/callback', { schema: { tags: ['auth'], description: 'Handle GitHub authentication callback' } }, githubCallbackController);
}
