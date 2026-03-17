import { FastifyReply, FastifyRequest } from "fastify";
import { deleteCartItem, findCartByUserId, findCartItem, findCartWithItems, findProductById } from "../repositories/cart.repository";
import { deleteCartItemInput } from "../schemas/cart.schema";


export async function deleteItemCart(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.user
    const { productId } = req.body as deleteCartItemInput

    const product = await findProductById(productId)
    const userCart = await findCartByUserId(id)

    if (!product) {
        return reply.status(404).send({
            success: false,
            message: 'Produto nao encontrado no banco de dados',
            statusCode: 404,
        })
    }
    if (!userCart) {
        return reply.status(403).send({
            success: false,
            message: 'Erro ao inicializar carrinho',
            statusCode: 400,
        })
    }
    const cartProduct = await findCartItem(userCart.id, productId)

    if (!cartProduct) {
        return reply.status(400).send({
            success: false,
            message: 'Produto nao esta em seu carrinho',
            statusCode: 400,
        })
    }

    const completeCart = await deleteCartItem(userCart.id, productId)

    if (!completeCart) {
        return reply.status(400).send({
            success: false,
            message: 'Erro ao deletar produto do carrinho',
            statusCode: 400,
        })
    }

    return reply.status(200).send({
        success: true,
        message: 'Produto deletado do carrinho com sucesso!',
        statusCode: 200,
    })

}
