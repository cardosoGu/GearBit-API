import { FastifyReply, FastifyRequest } from "fastify";
import { findCartByUserId, findCartWithItems } from "../repositories/cart.repository";
import { findUserById } from "../../product/repositories/product.repository";
import { calculateShippingFic } from "../../freight/service/freight.service";


export async function getItemsCart(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.user

    const user = await findUserById(id)

    const userCart = await findCartByUserId(id)

    if (!userCart) {
        return reply.status(403).send({
            success: false,
            message: 'Erro ao inicializar carrinho',
            statusCode: 400,
        })
    }

    const products = await findCartWithItems(userCart.id)

    const valorProdutos = products?.cartItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0) ?? 0
    let freightValue;
    if (user?.cep) {
        freightValue = await calculateShippingFic(products!.cartItems[0]!.id, user.cep)
    }
    return reply.status(200).send({
        success: true,
        message: products ? 'Carinnho do buscado com sucesso' : 'Carrinho do usuario esta vazio',
        statusCode: 200,
        data: {
            products,
            valorProdutos: valorProdutos.toFixed(2),
            freightValue,
            valorTotal: freightValue ? (valorProdutos + freightValue[0].price).toFixed(2) : valorProdutos.toFixed(2)
        }
    })

}
