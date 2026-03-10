import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';
import prisma from '#database';
import { createVerificationCode } from '../services/auth.createVerificationCode.js';
import { hashPassword } from '../../../lib/hash.js';
import { generateAccessToken, generateRefreshToken, parseExpiresInToMs } from '../../../lib/token.js';
import { env } from '../../../config/env.js';
import { mailer } from '../../../lib/mailer.js';


let app: FastifyInstance;

let code: string;

beforeAll(async () => {
    app = await buildApp();
    vi.spyOn(mailer, 'sendMail').mockResolvedValue({} as any);
    const user = await prisma.user.create({
        data: {
            name: 'Test User',
            email: 'test@test.com',
            password: await hashPassword('Password123@'), // hash da senha
        },
    });

    if (user && user.password) {
        code = await createVerificationCode(
            user.email,
            'Password123@',
            user.name,
        );
    }
    const refreshToken = generateRefreshToken(user!.id);
    const refreshExpiresAt = new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN));

    const pend = await prisma.pendingAuth.findFirst({ where: { email: user.email } });


    const session = await prisma.session.create({
        data: {
            userId: user.id,
            refreshToken,
            refreshExpiresAt,
            clientIp: '12312',
            userAgent: '12312'
        }
    });
})

afterAll(async () => {
    await app.close();

    const user = await prisma.user.findUnique({ where: { email: 'test@test.com' } });
    await prisma.session.deleteMany({ where: { userId: user?.id } });
    await prisma.user.deleteMany({ where: { email: { in: ['test@test.com', 'newuser@test.com'] } } });
    await prisma.pendingAuth.deleteMany({ where: { email: { in: ['test@test.com', 'newuser@test.com'] } } });
});


describe('POST /api/auth/verify', () => {
    it('should return 200 with valid code', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/verify',
            payload: { email: 'test@test.com', code: code }
        })
        expect(response.statusCode).toBe(200);
    })

    it('should return 400 with invalid code', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/verify',
            payload: { email: 'test@test.com', code: 'invalidcode' }
        })
        expect(response.statusCode).toBe(400);
    })
})

describe('POST /api/auth/register', () => {
    it('should return 400 with invalid body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { email: 'invalid-email', password: 'short' }
        })
        expect(response.statusCode).toBe(400);
    })

    it('should return 403 with email already exists', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { name: 'TestUser', email: 'test@test.com', password: 'Password123@' }
        })
        expect(response.statusCode).toBe(403);
    })
    it('Should return 201 with valid body', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/register',
            payload: { name: 'NewUser', email: 'newuser@test.com', password: 'Password123@' }
        })
        expect(response.statusCode).toBe(201);
    })
})

describe('POST /api/auth/login', () => {
    it('should return 200 with valid credentials', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'test@test.com', password: 'Password123@' }
        })
        expect(response.statusCode).toBe(200);
    })

    it('should return 401 with user not found', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'nonexistent@test.com', password: 'Password123@' }
        })
        expect(response.statusCode).toBe(401);
    })

    it('should return 401 with invalid password', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/login',
            payload: { email: 'test@test.com', password: 'WrongPassword' }
        })
        expect(response.statusCode).toBe(401);
    })
})


describe('POST /api/auth/me', () => {

    it('should return 200 with valid refresh token', async () => {
        const user = await prisma.user.findUnique({ where: { email: 'test@test.com' } });
        if (!user || !user.id) {
            throw new Error('User ID not found');
        }
        const accessToken = await generateAccessToken(user.id);

        const loginResponse = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
            cookies: { accessToken },
        })
        expect(loginResponse.statusCode).toBe(200);
    })

    it('should return 401 with invalid refresh token', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/auth/me',
        })
        expect(response.statusCode).toBe(401);
    })
})

describe('POST /api/auth/refresh', () => {
    it('should return 200 with valid refresh token', async () => {
        const user = await prisma.user.findUnique({ where: { email: 'test@test.com' } });
        const session = await prisma.session.findFirst({ where: { userId: user?.id } });
        if (!session || !session.refreshToken) {
            throw new Error('Session or refresh token not found');
        }

        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/refresh',
            cookies: { refreshToken: session.refreshToken },
        })
        expect(response.statusCode).toBe(200);
    })

    it('should return 401 with invalid refresh token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/refresh',
            cookies: { refreshToken: ' invalidtoken' },
        })
        expect(response.statusCode).toBe(401);
    })
})
describe('POST /api/auth/logout', () => {
    it('should return 200 with valid refresh token', async () => {
        const user = await prisma.user.findUnique({ where: { email: 'test@test.com' } });
        if (!user || !user.id) {
            throw new Error('User ID not found');
        }
        const accessToken = await generateAccessToken(user.id);
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(200);
    })

    it('should return 401 with invalid refresh token', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/auth/logout',
        })
        expect(response.statusCode).toBe(401);
    })
})
