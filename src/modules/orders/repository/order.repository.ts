import prisma from "#database";

export async function findCartItems(userId: string) {
    const cartId = await findUserCart(userId)

    return await prisma.cartItem.findMany({
        where: { cartShoppingId: cartId?.id }
    })
}

export async function findUserCart(userId: string) {
    return await prisma.cartShopping.findUnique({ where: { userId } })
}

