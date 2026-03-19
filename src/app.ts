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
import { shippingRoutes } from './modules/freight/routes/freight.routes.js';
import swagger from '@fastify/swagger';

import cors from '@fastify/cors'
import redis from './lib/redis.js';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { cartRoutes } from './modules/cartShopping/routes/cart.routes.js';
import { orderRoutes } from './modules/orders/routes/order.route.js';


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

  await redis.del('products')

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

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
  })

  // Routes
  await app.register(cartRoutes, { prefix: '/api/cart' })
  await app.register(productRoutes, { prefix: '/api/products' });
  await app.register(oauthRoutes, { prefix: '/api/auth/oauth' });
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(shippingRoutes, { prefix: '/api/shipping' })
  await app.register(orderRoutes, { prefix: '/api/order' })

  // Error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;

    reply.status(statusCode).send({
      success: false,
      message: error.message ?? 'Erro interno do servidor',
      statusCode,
    });
  });

  // 404 handler
  app.setNotFoundHandler((request, reply) => {
    const statusCode = 404;

    reply.status(statusCode).send({
      success: false,
      message: `Rota ${request.method} ${request.url} nao encontrada`,
      statusCode,
    });
  });

  await app.register(cors, {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })


  return app;
}


