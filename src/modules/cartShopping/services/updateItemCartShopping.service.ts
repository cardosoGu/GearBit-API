import { findProductById, findCartByUserId, findCartItem, addProductToCart, findCartWithItems, updateCartItem } from "../repositories/cart.repository"


export async function updateItemCartShoppingService(productId: string, id: string, updateType: 'increment' | 'decrement') {
    const product = await findProductById(productId)
    const userCart = await findCartByUserId(id)

    if (!product) {
        return {
            success: false,
            message: 'Produto nao encontrado no banco de dados',
            statusCode: 404,
        }
    }
    //verificacao de estoque
    const cartProduct = await findCartItem(userCart.id, product.id)

    if (!cartProduct) {
        return {
            success: false,
            message: 'Produto nao esta em seu carrinho',
            statusCode: 404,
        }
    }
    const newQuantity = cartProduct.quantity + 1

    if (product.stockQuantity < newQuantity) {
        return {
            success: false,
            message: 'Produto sem estoque suficiente',
            statusCode: 400,
        }
    }

    if (!userCart) {
        return {
            success: false,
            message: 'Erro ao inicializar carrinho',
            statusCode: 400,
        }
    }

    const productUpdated = await updateCartItem(userCart.id, productId, updateType)
    return {
        success: true,
        message: 'Produto atualizado com sucesso!',
        statusCode: 200,
        data: {
            product: productUpdated
        }
    }


}
