import { FastifyReply, FastifyRequest } from "fastify";
import { WebhookInput } from "../schema/order.schema";
import prisma from "#database";



export async function orderWebhookController(req: FastifyRequest, reply: FastifyReply) {
    const { event, payment } = req.body as WebhookInput

    if (event !== 'PAYMENT_RECEIVED') {
        return reply.status(200).send()
    }

    const status = payment.status

    await prisma.$transaction(async (tx) => {

        const order = await tx.order.findFirst({ where: { paymentId: payment.id }, include: { orderItems: true } })

        if (!order) {
            return
        }
        await tx.order.update({
            where: { id: order.id },
            data: { status: status === 'RECEIVED' ? 'PAID' : 'CANCELED' }
        })

        if (status !== 'RECEIVED') {
            await Promise.all(order.orderItems.map(item =>
                tx.product.update({
                    where: { id: item.productId },
                    data: { stockQuantity: { increment: item.quantity } }
                })
            ))
        }
    })

    return reply.status(200).send()

}
