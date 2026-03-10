/**
 * Prefix: /api/products
 */

import { FastifyInstance } from "fastify";
import { authMiddleware } from "../../auth/middleware/auth.middleware.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../schemas/product.schema.js";
import { createProductController, deleteProductController, productController, productsController, updateProductController } from "../controllers/products.controller.js";

export async function productRoutes(app: FastifyInstance) {
  // TODO: IMPLEMENTAR FILTRO DE ADMIN PARA CREATE, UPDATE E DELETE PRODUCTS
  app.post(
    "/",
    { schema: { body: createProductSchema, tags: ['products'], description: 'Create a new product' }, preHandler: authMiddleware },
    createProductController,
  );
  //update product
  app.put(
    "/:id",
    { schema: { body: updateProductSchema, tags: ['products'], description: 'Update a product' }, preHandler: authMiddleware },
    updateProductController,
  );
  //delete product
  app.delete("/:id", { schema: { tags: ['products'], description: 'Delete a product' }, preHandler: authMiddleware }, deleteProductController);

  //Get all products
  app.get("/", { schema: { tags: ['products'], description: 'Get all products' }, preHandler: authMiddleware }, productsController);
  //Get product by id
  app.get("/:id", { schema: { tags: ['products'], description: 'Get product by id' }, preHandler: authMiddleware }, productController);
}
