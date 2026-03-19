import { FastifyReply, FastifyRequest } from "fastify";
import { findCartItems } from "../repository/order.repository";
import prisma from "#database";
import { getProductById } from "../../product/repositories/product.repository";
import { env } from "../../../config/env";
import { OrderInput } from "../schema/order.schema";


//funcao para fechar order e gerar pagamento
export async function orderController(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user.id
    const { cpf } = req.body as OrderInput

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user?.cep) {
        return reply.status(400).send({
            success: false,
            message: 'Por favor cadastre seu CEP antes de prosseguir a compra!',
            statusCode: 400
        })
    }

    const cartItems = await findCartItems(userId)

    if (!cartItems || cartItems.length < 1) {
        return reply.status(404).send({
            success: false,
            message: 'Carrinho vazio! Por favor adicione items em seu carrinho',
            statusCode: 404
        })
    }

    for (const item of cartItems) {
        const stock = await getProductById(item.productId)
        if (item.quantity > stock!.stockQuantity) {
            return reply.status(400).send({
                success: false,
                message: `Produto ${stock?.name} sem estoque! Por favor tente novamente em breve`,
                statusCode: 400
            })
        }
    }

    const valorTotal = cartItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)

    // criar order, order items, atualizar estoque e gerar pagamento no mercado pago em uma transação
    // case de erro, o transiction cancela todos
    const { qrCode, qrCodeBase64 } = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
            data: {
                userId,
                price: valorTotal,
                status: 'PENDING',
                expiresAt: new Date(Date.now() + 20 * 60 * 1000),
            }
        })

        await Promise.all(cartItems.map(async (item) => {
            await tx.orderItem.create({
                data: {
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    orderId: order.id,
                    productId: item.productId,
                }
            })

            await tx.product.update({
                where: { id: item.productId },
                data: { stockQuantity: { decrement: item.quantity } }
            })
        }))

        const responseCustomers = await fetch(`${env.ASAAS_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            },
            body: JSON.stringify({ name: user.name, email: user.email, cpfCnpj: cpf })
        })

        const customer = await responseCustomers.json()
        console.log('customer:', customer)

        const responsePayments = await fetch(`${env.ASAAS_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            },
            body: JSON.stringify({
                customer: customer.id,
                billingType: 'PIX',
                value: 5,
                dueDate: order.expiresAt!.toISOString().split('T')[0]
            }),
        })

        const payment = await responsePayments.json()
        console.log('payment:', payment)


        const responseQrCode = await fetch(`${env.ASAAS_URL}/payments/${payment.id}/pixQrCode`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            }
        })
        const QrCode = await responseQrCode.json()
        console.log('qrcode:', QrCode)

        await tx.order.update({
            where: { id: order.id },
            data: { paymentId: payment.id!.toString() }
        })


        //reset no carrinho
        const cartShopping = await tx.cartShopping.findUnique({ where: { userId } })
        await tx.cartItem.deleteMany({ where: { cartShoppingId: cartShopping!.id } })

        return { qrCode: QrCode.payload, qrCodeBase64: QrCode.encodedImage }
    })

    return reply.status(201).send({
        success: true,
        message: 'Pedido criado com sucesso!',
        data: { qrCode, qrCodeBase64 }
    })
}
