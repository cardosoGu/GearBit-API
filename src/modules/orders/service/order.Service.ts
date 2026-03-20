import prisma from "#database"
import { env } from "../../../config/env"
import { getProductById } from "../../product/repositories/product.repository"
import { findCartItems } from "../repository/order.repository"

export async function orderService(userId: string, cpf: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user?.cep) {
        return {
            success: false,
            message: 'Por favor cadastre seu CEP antes de prosseguir a compra!',
            statusCode: 400
        }
    }

    const cartItems = await findCartItems(userId)

    if (!cartItems || cartItems.length < 1) {
        return {
            success: false,
            message: 'Carrinho vazio! Por favor adicione items em seu carrinho',
            statusCode: 404
        }
    }

    for (const item of cartItems) {
        const stock = await getProductById(item.productId)
        if (item.quantity > stock!.stockQuantity) {
            return {
                success: false,
                message: `Produto ${stock?.name} sem estoque! Por favor tente novamente em breve`,
                statusCode: 400
            }
        }
    }

    const valorTotal = cartItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0)

    // criar order, order items, atualizar estoque e gerar pagamento no mercado pago em uma transação
    // case de erro, o transiction cancela todos
    const { order } = await prisma.$transaction(async (tx) => {
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
        //reset no carrinho
        const cartShopping = await tx.cartShopping.findUnique({ where: { userId } })
        await tx.cartItem.deleteMany({ where: { cartShoppingId: cartShopping!.id } })

        return { order }
    })

    try {
        const responseCustomers = await fetch(`${env.ASAAS_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            },
            body: JSON.stringify({ name: user.name, email: user.email, cpfCnpj: cpf })
        })

        const customer = await responseCustomers.json()


        const responsePayments = await fetch(`${env.ASAAS_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            },
            body: JSON.stringify({
                customer: customer.id,
                billingType: 'PIX',
                value: 5, // value just to test the payment system
                dueDate: order.expiresAt!.toISOString().split('T')[0]
            }),
        })

        const payment = await responsePayments.json()



        const responseQrCode = await fetch(`${env.ASAAS_URL}/payments/${payment.id}/pixQrCode`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'access_token': env.ASAAS_API_KEY
            }
        })
        const QrCode = await responseQrCode.json()

        await prisma.order.update({
            where: { id: order.id },
            data: { paymentId: payment.id!.toString() }
        })

        return {
            success: true,
            message: 'Pedido criado com sucesso!',
            statusCode: 201,
            orderId: order.paymentId,
            data: { qrCode: QrCode.payload, qrCodeBase64: QrCode.encodedImage }
        }
    } catch (e) {
        await prisma.order.update({
            where: { id: order.id },
            data: { status: "CANCELED" }
        })

        return {
            success: false,
            message: 'Erro ao gerar pagamento, tente novamente',
            statusCode: 500,
        }
    }
}
