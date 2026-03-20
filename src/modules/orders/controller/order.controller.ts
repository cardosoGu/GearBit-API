import { FastifyReply, FastifyRequest } from "fastify";
import { OrderInput } from "../schema/order.schema";
import { orderService } from "../service/order.Service";


//funcao para fechar order e gerar pagamento
export async function orderController(req: FastifyRequest, reply: FastifyReply) {
    const userId = req.user.id
    const { cpf } = req.body as OrderInput

    const data = await orderService(userId, cpf)

    return reply.status(data.statusCode).send(data)
}
