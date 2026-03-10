import { FastifyRequest, FastifyReply } from 'fastify';
import {
  findRateLimit,
  resetRateLimit,
  updateOrCreateRateLimit,
} from '../modules/auth/repositories/auth.repository';

const RATE_LIMIT_CONFIG: Record<string, { maxHits: number; windowMs: number }> = {
  '/api/auth/register': { maxHits: 5, windowMs: 60 * 60 * 1000 },
  '/api/auth/login': { maxHits: 10, windowMs: 60 * 60 * 1000 },
  '/api/auth/verify': { maxHits: 5, windowMs: 60 * 60 * 1000 },
  '/api/auth/refresh': { maxHits: 30, windowMs: 60 * 60 * 1000 },
};

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply) {
if (process.env.NODE_ENV === 'test') return;  

  const route = request.routeOptions.url ?? request.url;
  const config = RATE_LIMIT_CONFIG[route];

  if (!config) return;

  const clientIp = request.ip;
  const now = new Date();

  const existing = await findRateLimit(clientIp, route);

  if (existing && existing?.expiresAt < now) {
    await resetRateLimit(clientIp, route, new Date(now.getTime() + config.windowMs));
  }

  const rateLimit = await updateOrCreateRateLimit({
    clientIp,
    route,
    expiresAt: new Date(now.getTime() + config.windowMs),
  });

  if (rateLimit.hits > config.maxHits) {
    const retryAfter = Math.ceil((rateLimit!.expiresAt.getTime() - now.getTime()) / 1000);
    return reply.status(429).send({
      success: false,
      message: 'Too many requests. Try again later.',
      retryAfter,
    });
  }
}
