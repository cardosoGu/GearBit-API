// prefix: /api/order
import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../../shared/middleware/auth.middleware";
import { orderController } from "../controller/order.controller";
import { orderWebhookController } from "../controller/orderWebhook.controller";
import { orderSchema, webhookSchema } from "../schema/order.schema";


export async function orderRoutes(app: FastifyInstance) {

    app.post('/', { schema: { body: orderSchema, tags: ['Order'], description: 'create a new order with cart' }, preHandler: authMiddleware }, orderController)

    app.post('/webhook', { schema: { body: webhookSchema, tags: ['Order'], description: 'webhook for handling payment notifications' }, preHandler: authMiddleware }, orderWebhookController)

}
