import { FastifyInstance } from "fastify";
import { beforeAll, it, afterAll, describe, expect, vi } from "vitest";
import { buildApp } from "../../../app.js";
import prisma from "#database";
import { generateAccessToken, generateRefreshToken, parseExpiresInToMs } from "../../../lib/token.js";
import { env } from '../../../config/env.js';
import { hashPassword } from "../../../lib/hash.js";
import { mailer } from "../../../lib/mailer.js";

let app: FastifyInstance;
let accessToken: string;   // user normal
let adminToken: string;    // admin
let productId: string;     // produto criado no beforeAll

beforeAll(async () => {
    app = await buildApp();
    vi.spyOn(mailer, 'sendMail').mockResolvedValue({} as any);

    // limpa dados de testes anteriores
    await prisma.product.deleteMany({ where: { name: 'Test Product' } });
    await prisma.session.deleteMany({ where: { user: { email: { in: ['product-test@test.com', 'product-admin@test.com'] } } } });
    await prisma.user.deleteMany({ where: { email: { in: ['product-test@test.com', 'product-admin@test.com'] } } });

    // cria user normal
    const user = await prisma.user.create({
        data: {
            name: 'Product Test User',
            email: 'product-test@test.com',
            password: await hashPassword('Password123@'),
        },
    });

    // cria admin
    const admin = await prisma.user.create({
        data: {
            name: 'Product Admin User',
            email: 'product-admin@test.com',
            password: await hashPassword('Password123@'),
            role: 'ADMIN',
        },
    });

    const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

    await prisma.session.create({
        data: {
            userId: user.id,
            refreshToken: generateRefreshToken(user.id),
            refreshExpiresAt,
            clientIp: '127.0.0.1',
            userAgent: 'test',
        }
    });

    await prisma.session.create({
        data: {
            userId: admin.id,
            refreshToken: generateRefreshToken(admin.id),
            refreshExpiresAt,
            clientIp: '127.0.0.1',
            userAgent: 'test',
        }
    });

    accessToken = generateAccessToken(user.id);
    adminToken = generateAccessToken(admin.id);

    // cria produto pra usar nos testes de get/update/delete
    const product = await prisma.product.create({
        data: {
            name: 'Test Product',
            description: 'Test description',
            price: 99.99,
            stockQuantity: 10,
        }
    });

    productId = product.id;
});

afterAll(async () => {
    await app.close();

    await prisma.product.deleteMany({ where: { name: { in: ['Test Product', 'Created Product', 'Updated Product'] } } });
    await prisma.session.deleteMany({ where: { user: { email: { in: ['product-test@test.com', 'product-admin@test.com'] } } } });
    await prisma.user.deleteMany({ where: { email: { in: ['product-test@test.com', 'product-admin@test.com'] } } });
});

// =====================
// CREATE
// =====================
describe('POST /api/products', () => {
    it('should return 401 without token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/products',
            payload: {
                name: 'Created Product',
                description: 'desc',
                imageUrl: 'http://example.com/image.jpg',
                price: 49.99,
                stockQuantity: 5,
            }
        });
        expect(response.statusCode).toBe(401);
    });

    it('should return 403 if user is not admin', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/products',
            payload: {
                name: 'Created Product',
                description: 'desc',
                imageUrl: 'http://example.com/image.jpg',
                price: 49.99,
                stockQuantity: 5,
            },
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(403);
    });

    it('should return 400 with invalid body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/products',
            payload: { name: 123, price: 'invalid' },
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(400);
    });

    it('should return 201 with valid body and admin token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/products',
            payload: {
                name: 'Created Product',
                description: 'desc',
                imageUrl: 'http://example.com/image.jpg',
                price: 49.99,
                stockQuantity: 5,
            },
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(201);
    });
});

// =====================
// GET ALL
// =====================
describe('GET /api/products', () => {
    it('should return 401 without token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/products',
        });
        expect(response.statusCode).toBe(401);
    });

    it('should return 200 with valid token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/products',
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(Array.isArray(body.products)).toBe(true);
    });
});

// =====================
// GET BY ID
// =====================
describe('GET /api/products/:id', () => {
    it('should return 401 without token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/products/${productId}`,
        });
        expect(response.statusCode).toBe(401);
    });

    it('should return 200 with valid id', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/products/${productId}`,
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(200);
    });

    it('should return 404 with nonexistent id', async () => {
        const response = await app.inject({
            method: 'GET',
            url: `/api/products/00000000-0000-0000-0000-000000000000`,
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(404);
    });
});

// =====================
// UPDATE
// =====================
describe('PUT /api/products/:id', () => {
    it('should return 401 without token', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: `/api/products/${productId}`,
            payload: { name: 'Updated Product' }
        });
        expect(response.statusCode).toBe(401);
    });

    it('should return 403 if user is not admin', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: `/api/products/${productId}`,
            payload: { name: 'Updated Product' },
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(403);
    });

    it('should return 404 with nonexistent id', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: `/api/products/00000000-0000-0000-0000-000000000000`,
            payload: { name: 'Updated Product' },
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 200 with valid data and admin token', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: `/api/products/${productId}`,
            payload: { name: 'Updated Product', price: 149.99 },
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(200);
    });
});

// =====================
// DELETE
// =====================
describe('DELETE /api/products/:id', () => {
    it('should return 401 without token', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: `/api/products/${productId}`,
        });
        expect(response.statusCode).toBe(401);
    });

    it('should return 403 if user is not admin', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: `/api/products/${productId}`,
            cookies: { accessToken }
        });
        expect(response.statusCode).toBe(403);
    });

    it('should return 404 with nonexistent id', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: `/api/products/00000000-0000-0000-0000-000000000000`,
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 200 with valid id and admin token', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: `/api/products/${productId}`,
            cookies: { accessToken: adminToken }
        });
        expect(response.statusCode).toBe(200);
    });
});
