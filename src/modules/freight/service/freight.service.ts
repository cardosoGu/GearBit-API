import prisma from "#database"



// Usando service de dados ficticios, porque a api de melhorenvio só da para integrar com a api em PROD
export async function calculateShippingFic(productId: string, cepDestino: string) {
    const product = await prisma.product.findUnique({
        where: { id: productId }
    })
    if (!product) return

    return [
        { name: "PAC", price: 19.90, delivery_time: 7 },
        { name: "SEDEX", price: 34.90, delivery_time: 2 },
    ]
}

export async function calculateShipping(productId: string, cepDestino: string) {
    const product = await prisma.product.findUnique({
        where: { id: productId }
    })
    if (!product) {
        throw new Error("Produto não encontrado")
    }
    console.log("TOKEN:==============================================================", process.env.MELHOR_ENVIO_TOKEN)
    const response = await fetch(
        "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": "GearBit/1.0 (noreplycardosoworks@gmail.com)",
            },
            body: JSON.stringify({
                from: {
                    postal_code: process.env.MELHOR_ENVIO_CEP_ORIGEM
                },
                to: {
                    postal_code: cepDestino
                },
                products: [{
                    width: product.width,
                    height: product.height,
                    length: product.length,
                    weight: product.weight,
                    insurance_value: product.price,
                    quantity: 1
                }]
            })
        }
    )
    const data = await response.json()
    if (!Array.isArray(data)) {
    throw new Error("Erro ao calcular frete: " + JSON.stringify(data))
}

const fretesFiltrados = data.filter((frete: any) => !frete.error)
return fretesFiltrados
}
