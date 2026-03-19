import z from "zod";

export const orderSchema = z.object({
    cpf: z.string().refine((cpf) => {
        const cleaned = cpf.replace(/\D/g, '')
        return cleaned.length === 11
    }, { message: 'CPF inválido' })
})

export const webhookSchema = z.object({
    event: z.string(),
    payment: z.object({
        id: z.string(),
        status: z.string(),
        externalReference: z.string().nullable()
    })
})

export type WebhookInput = z.infer<typeof webhookSchema>
export type OrderInput = z.infer<typeof orderSchema>
