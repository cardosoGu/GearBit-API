import { FastifyRequest, FastifyReply } from "fastify"
import { calculateShippingFic } from "../service/freight.service"
import { shippingInput } from "../schema/freight.schema"
import prisma from "#database"

export async function calculateShippingController(
    req: FastifyRequest,
    reply: FastifyReply
) {
    const { productId, cep } = req.body as shippingInput
    const { id, sessionId } = req.user
    const fretes = await calculateShippingFic(productId, cep)

    await prisma.user.update({
        where: { id },
        data: {
            cep
        }
    })

    if (!fretes) {
        return reply.status(404).send({
            success: false,
            message: 'Produto nao encontrado',
            statusCode: 404,
        })
    }

    return reply.status(200).send({
        success: true,
        message: 'Frete calculado com sucesso',
        statusCode: 200,
        data: { fretes },
    })
}

