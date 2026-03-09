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
    { schema: { body: createProductSchema }, preHandler: authMiddleware },
    createProductController,
  );
  //update product
  app.put(
    "/:id",
    { schema: { body: updateProductSchema }, preHandler: authMiddleware },
    updateProductController,
  );
  //delete product
  app.delete("/:id", { preHandler: authMiddleware }, deleteProductController);

  //Get all products
  app.get("/", { preHandler: authMiddleware }, productsController);
  //Get product by id
  app.get("/:id", { preHandler: authMiddleware }, productController);
}
