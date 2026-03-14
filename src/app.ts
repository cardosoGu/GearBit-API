import 'dotenv/config';
import Fastify, { FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider
} from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { authRoutes } from './modules/auth/routes/auth.route.js';
import { oauthRoutes } from './modules/auth/routes/oauth.route.js';
import { productRoutes } from './modules/product/routes/product.routes.js';
import { shippingRoutes } from './modules/shipping/routes/shipping.routes.js';
import swagger from '@fastify/swagger';
import ScalarApiReference from '@scalar/fastify-api-reference'
import cors from '@fastify/cors'
import redis from './lib/redis.js';


export async function buildApp() {
  const app = Fastify({
    trustProxy: true,
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV !== 'production'
          ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();


  // Zod validation
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production'
  });
  await app.register(cookie);

  // swagger
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'GearBit API',
        description: 'API for GearBit e-commerce platform',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'refreshToken',
          },
        },
      },
    },
    transform: jsonSchemaTransform
  })

  await app.register(ScalarApiReference, {
    routePrefix: '/docs',
  })

  // Routes
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(oauthRoutes, { prefix: '/api/auth/oauth' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(shippingRoutes, { prefix: '/api/shipping' })

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      success: false,
      message: error.message ?? 'Internal server error',
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      message: `Route ${request.method} ${request.url} not found`,
    });
  });

  await app.register(cors, {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })


  return app;
}


