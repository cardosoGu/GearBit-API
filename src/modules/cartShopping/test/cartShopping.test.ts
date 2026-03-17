import { FastifyInstance } from "fastify";
import { afterAll, beforeAll, expect, it, describe } from "vitest";
import { buildApp } from "../../../app";
import prisma from "#database";
import { generateAccessToken, generateRefreshToken, parseExpiresInToMs } from "../../../lib/token";
import { hashPassword } from "../../../lib/hash";
import { env } from "../../../config/env";
import { findCartItem } from "../repositories/cart.repository";


let app: FastifyInstance
let accessToken: string
let productId: string
let userId: string

beforeAll(async () => {
    app = await buildApp()
    await prisma.user.deleteMany({ where: { email: 'carttest@test.com' } })
    await prisma.product.deleteMany({ where: { name: 'Cart Test Product' } })
    const user = await prisma.user.create({
        data: {
            name: 'Cart Test User',
            email: 'carttest@test.com',
            password: await hashPassword('Password123@'),
        },
    });

    userId = user.id

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

    accessToken = generateAccessToken(user.id);

    const product = await prisma.product.create({
        data: {
            name: 'Cart Test Product',
            description: 'Test description',
            price: 99.99,
            stockQuantity: 1,
            weight: 0.5,
            width: 10,
            height: 10,
            length: 10,
        }
    });

    productId = product.id
})

afterAll(async () => {
    const cart = await prisma.cartShopping.findUnique({
        where: { userId }
    })

    if (cart) {
        await prisma.cartItem.deleteMany({
            where: { cartShoppingId: cart.id }
        });
    }

    await prisma.product.deleteMany({ where: { name: 'Cart Test Product' } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email: 'carttest@test.com' } });
    await app.close()
})


describe('POST /api/cart', () => {
    it('should add item to cart', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(201)
    })

    it('should return 400 if productId is missing', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: {},
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(400)
    })

    it('should return 401 if user is not logged in', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId },
        })
        expect(response.statusCode).toBe(401)
    })

    it('should return 400 if product has no stock', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(400)
    })

    it('should return 404 if product does not exist', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId: 'non_existent_id' },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(404)
    })
})


describe('GET /api/cart', () => {
    it('should return all products of user cart', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/cart',
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(200)
        const json = response.json()
        expect(json.data.products.cartItems).toBeInstanceOf(Array)
    })

    it('should return 401 if user is not logged in', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/cart',
        })
        expect(response.statusCode).toBe(401)
    })
})


describe('PUT /api/cart', () => {
    beforeAll(async () => {

        await prisma.product.update({
            where: { id: productId },
            data: { stockQuantity: 10 },
        })

        await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId },
            cookies: { accessToken },
        })
    })

    it('should increment item quantity', async () => {
        const cartShopping = await prisma.cartShopping.findUnique({ where: { userId } })
        const cartItem = await findCartItem(cartShopping!.id, productId)

        expect(cartItem).not.toBeNull()

        const response = await app.inject({
            method: 'PUT',
            url: '/api/cart',
            payload: { productId, type: 'increment' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(200)
        const json = response.json()
        expect(json.data.product.quantity).toBe(cartItem!.quantity + 1)
    })

    it('should decrement item quantity', async () => {
        const cartShopping = await prisma.cartShopping.findUnique({ where: { userId } })
        const cartItem = await prisma.cartItem.findUnique({
            where: {
                cartShoppingId_productId: {
                    cartShoppingId: cartShopping!.id,
                    productId,
                }
            }
        })

        expect(cartItem).not.toBeNull()

        const response = await app.inject({
            method: 'PUT',
            url: '/api/cart',
            payload: { productId, type: 'decrement' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(200)
        const json = response.json()
        expect(json.data.product.quantity).toBe(cartItem!.quantity - 1)
    })

    it('should return 401 if user is not logged in', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/cart',
            payload: { productId, type: 'increment' },
        })
        expect(response.statusCode).toBe(401)
    })

    it('should return 400 if body is invalid', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/cart',
            payload: {},
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(400)
    })

    it('should return 404 if item is not in cart', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/cart',
            payload: { productId: 'non_existent_id', type: 'increment' },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(404)
    })
})


describe('DELETE /api/cart', () => {
    beforeAll(async () => {
        await app.inject({
            method: 'POST',
            url: '/api/cart',
            payload: { productId },
            cookies: { accessToken },
        })
    })

    it('should remove item from cart', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/cart',
            payload: { productId },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(200)

        const cartShopping = await prisma.cartShopping.findUnique({ where: { userId } })
        const cartItem = await prisma.cartItem.findUnique({
            where: {
                cartShoppingId_productId: {
                    cartShoppingId: cartShopping!.id,
                    productId,
                }
            }
        })
        expect(cartItem).toBeNull()
    })

    it('should return 401 if user is not logged in', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/cart',
            payload: { productId },
        })
        expect(response.statusCode).toBe(401)
    })

    it('should return 400 if body is invalid', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/cart',
            payload: {},
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(400)
    })

    it('should return 404 if item is not in cart', async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/cart',
            payload: { productId: 'non_existent_id' },
            cookies: { accessToken },
        })
        expect(response.statusCode).toBe(404)
    })
})
