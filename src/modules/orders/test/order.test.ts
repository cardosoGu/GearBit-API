import { FastifyInstance } from "fastify"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { buildApp } from "../../../app"
import prisma from "#database"
import { generateAccessToken, parseExpiresInToMs, generateRefreshToken } from "../../../lib/token"
import { hashPassword } from "../../../lib/hash"
import { env } from "../../../config/env"

let app: FastifyInstance
let accessToken: string
let userId: string
let productId: string

// ─── Mocks do Asaas ───────────────────────────────────────────────────────────

const mockFetchAsaas = () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url.includes('/customers')) {
            return { json: async () => ({ id: 'cus_mock123' }) }
        }
        if (url.includes('/payments') && !url.includes('pixQrCode')) {
            return { json: async () => ({ id: 'pay_mock123' }) }
        }
        if (url.includes('pixQrCode')) {
            return {
                json: async () => ({
                    payload: 'pix_qrcode_mock_payload',
                    encodedImage: 'base64_encoded_image_mock'
                })
            }
        }
    }) as any)
}

const mockFetchAsaasFailure = () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
        throw new Error('Asaas unavailable')
    }) as any)
}

// ─── Setup global ─────────────────────────────────────────────────────────────

beforeAll(async () => {
    app = await buildApp()

    await prisma.user.deleteMany({ where: { email: 'ordertest@test.com' } })
    await prisma.user.deleteMany({ where: { email: 'nocep@test.com' } }) // ← limpa resíduo de runs anteriores
    await prisma.product.deleteMany({ where: { name: 'Order Test Product' } })

    const user = await prisma.user.create({
        data: {
            name: 'Order Test User',
            email: 'ordertest@test.com',
            password: await hashPassword('Password123@'),
            cep: '13320000',
        }
    })

    userId = user.id

    await prisma.session.create({
        data: {
            userId,
            refreshToken: generateRefreshToken(userId),
            refreshExpiresAt: new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN)),
            clientIp: '127.0.0.1',
            userAgent: 'test',
        }
    })

    accessToken = generateAccessToken(userId)

    const product = await prisma.product.create({
        data: {
            name: 'Order Test Product',
            description: 'Test description',
            price: 199.99,
            stockQuantity: 10,
            weight: 0.5,
            width: 10,
            height: 10,
            length: 10,
        }
    })

    productId = product.id
})

afterAll(async () => {
    vi.unstubAllGlobals()

    await prisma.orderItem.deleteMany({ where: { order: { userId } } })
    await prisma.order.deleteMany({ where: { userId } })

    const cart = await prisma.cartShopping.findUnique({ where: { userId } })
    if (cart) {
        await prisma.cartItem.deleteMany({ where: { cartShoppingId: cart.id } })
    }

    await prisma.product.deleteMany({ where: { name: 'Order Test Product' } })
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { email: 'ordertest@test.com' } })

    await app.close()
})

afterEach(async () => {
    vi.unstubAllGlobals()
})

async function addProductToCart() {
    await app.inject({
        method: 'POST',
        url: '/api/cart',
        payload: { productId },
        cookies: { accessToken },
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/order', () => {
    it('should return 401 if user is not logged in', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
        })
        expect(response.statusCode).toBe(401)
    })

    it('should return 400 if user has no CEP registered', async () => {
        await prisma.user.deleteMany({ where: { email: 'nocep@test.com' } }) // ← evita unique constraint

        const userNoCep = await prisma.user.create({
            data: {
                name: 'No CEP User',
                email: 'nocep@test.com',
                password: await hashPassword('Password123@'),
            }
        })

        await prisma.session.create({
            data: {
                userId: userNoCep.id,
                refreshToken: generateRefreshToken(userNoCep.id),
                refreshExpiresAt: new Date(Date.now() + parseExpiresInToMs(env.JWT_REFRESH_EXPIRES_IN)),
                clientIp: '127.0.0.1',
                userAgent: 'test',
            }
        })

        const tokenNoCep = generateAccessToken(userNoCep.id)

        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
            cookies: { accessToken: tokenNoCep },
        })

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toContain('CEP')

        await prisma.session.deleteMany({ where: { userId: userNoCep.id } })
        await prisma.user.delete({ where: { id: userNoCep.id } })
    })

    it('should return 404 if cart is empty', async () => {
        // Garante que o cartShopping existe antes de tentar limpar — evita crash no findCartItems
        await addProductToCart()
        const cart = await prisma.cartShopping.findUnique({ where: { userId } })
        if (cart) await prisma.cartItem.deleteMany({ where: { cartShoppingId: cart.id } })

        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(404)
        expect(response.json().message).toContain('Carrinho vazio')
    })

    it('should return 400 if product is out of stock', async () => {
        mockFetchAsaas() // ← previne chamada real se o código vazar até o Asaas
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 10 } })
        await addProductToCart() // ← adiciona primeiro com estoque disponível
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 0 } }) // ← zera depois

        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toContain('sem estoque')

        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 10 } })
        const cart = await prisma.cartShopping.findUnique({ where: { userId } })
        if (cart) await prisma.cartItem.deleteMany({ where: { cartShoppingId: cart.id } })
    }, 15000)

    it('should create order, decrement stock and clear cart on success', async () => {
        mockFetchAsaas()
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 10 } })
        await addProductToCart()

        const stockBefore = await prisma.product.findUnique({ where: { id: productId } })

        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(201)

        const json = response.json()
        expect(json.success).toBe(true)
        expect(json.data.qrCode).toBe('pix_qrcode_mock_payload')
        expect(json.data.qrCodeBase64).toBe('base64_encoded_image_mock')

        const stockAfter = await prisma.product.findUnique({ where: { id: productId } })
        expect(stockAfter!.stockQuantity).toBe(stockBefore!.stockQuantity - 1)

        const cart = await prisma.cartShopping.findUnique({ where: { userId } })
        if (cart) {
            const cartItems = await prisma.cartItem.findMany({ where: { cartShoppingId: cart.id } })
            expect(cartItems).toHaveLength(0)
        }

        const order = await prisma.order.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        })
        expect(order).not.toBeNull()
        expect(order!.status).toBe('PENDING')
        expect(order!.paymentId).toBe('pay_mock123')
    }, 15000)

    it('should cancel order if Asaas fails', async () => {
        mockFetchAsaasFailure()
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 10 } })
        await addProductToCart()

        const response = await app.inject({
            method: 'POST',
            url: '/api/order',
            payload: { cpf: '12345678901' },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(500)

        const order = await prisma.order.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        })
        expect(order!.status).toBe('CANCELED')
    }, 15000)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/order/webhook
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/order/webhook', () => {
    let orderId: string
    const paymentId = 'pay_webhook_test'

    beforeEach(async () => {
        await prisma.product.update({ where: { id: productId }, data: { stockQuantity: 10 } })

        const order = await prisma.order.create({
            data: {
                userId,
                price: 199.99,
                status: 'PENDING',
                paymentId,
                expiresAt: new Date(Date.now() + 20 * 60 * 1000),
                orderItems: {
                    create: {
                        productId,
                        quantity: 2,
                        unitPrice: 199.99,
                    }
                }
            }
        })

        orderId = order.id
    })

    afterEach(async () => {
        await prisma.orderItem.deleteMany({ where: { orderId } })
        await prisma.order.deleteMany({ where: { id: orderId } })
    })

    it('should return 200 and ignore events that are not PAYMENT_RECEIVED', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/order/webhook',
            payload: {
                event: 'PAYMENT_CREATED',
                payment: { id: paymentId, status: 'PENDING', externalReference: null }
            },
            cookies: { accessToken }, // ← rota protegida por auth
        })

        expect(response.statusCode).toBe(200)

        const order = await prisma.order.findUnique({ where: { id: orderId } })
        expect(order!.status).toBe('PENDING')
    })

    it('should mark order as PAID when payment is RECEIVED', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/order/webhook',
            payload: {
                event: 'PAYMENT_RECEIVED',
                payment: { id: paymentId, status: 'RECEIVED', externalReference: null }
            },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(200)

        const order = await prisma.order.findUnique({ where: { id: orderId } })
        expect(order!.status).toBe('PAID')
    })

    it('should mark order as CANCELED and restore stock when payment fails', async () => {
        const stockBefore = await prisma.product.findUnique({ where: { id: productId } })

        const response = await app.inject({
            method: 'POST',
            url: '/api/order/webhook',
            payload: {
                event: 'PAYMENT_RECEIVED',
                payment: { id: paymentId, status: 'OVERDUE', externalReference: null }
            },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(200)

        const order = await prisma.order.findUnique({ where: { id: orderId } })
        expect(order!.status).toBe('CANCELED')

        const stockAfter = await prisma.product.findUnique({ where: { id: productId } })
        expect(stockAfter!.stockQuantity).toBe(stockBefore!.stockQuantity + 2)
    })

    it('should return 200 silently if paymentId does not match any order', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/order/webhook',
            payload: {
                event: 'PAYMENT_RECEIVED',
                payment: { id: 'pay_inexistente', status: 'RECEIVED', externalReference: null }
            },
            cookies: { accessToken },
        })

        expect(response.statusCode).toBe(200)
    })
})
