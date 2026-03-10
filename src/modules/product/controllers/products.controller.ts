import { FastifyReply, FastifyRequest } from "fastify";
import {
  deleteProduct,
  getAllProducts,
  getProductById,
  updateProduct,
} from "../repositories/product.repository";

import {
  createProduct,

} from "../repositories/product.repository";
import { createProductInput, updateProductInput } from "../schemas/product.schema";

type parameters = {
  id: string;
};


//CREATE NEW PRODUCT
export async function createProductController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id, isAdmin } = req.user as any;
  const { name, description, price, imageUrl, stockQuantity } =
    req.body as createProductInput;


  if (!isAdmin) {
    return reply.status(403).send({ message: "Forbidden: Admins only" });
  }

  const product = await createProduct(
    name,
    description,
    price,
    imageUrl,
    stockQuantity,
  );
  if(!product) {
    return reply.status(500).send({ message: "Failed to create product" });
   }

  return reply
    .status(201)
    .send({ message: "Product created successfully", product });

}
// DELETE PRODUCT
export async function deleteProductController(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as parameters;
  const { isAdmin } = req.user as any;

  if (!isAdmin) {
    return reply.status(403).send({ message: 'Forbidden: Admins only' });
  }

  const product = await getProductById(id);
  if (!product) {
    return reply.status(404).send({ message: 'Product not found' });
  }

  await deleteProduct(id);
  return reply.status(200).send({ message: 'Product deleted successfully' });
}

// UPDATE PRODUCT
export async function updateProductController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = req.params as parameters;
  const data = req.body as updateProductInput;
  const { isAdmin } = req.user as any;

  if (!isAdmin) {
    return reply.status(403).send({ message: "Forbidden: Admins only" });
  }

  const product = await getProductById(id);
  if (!product) {
    return reply.status(404).send({ message: "Product not found" });
  }

  const updatedProduct = await updateProduct(id, data);

  return reply
    .status(200)
    .send({ message: "Product updated successfully", product: updatedProduct });
}

// GET ALL PRODUCTS
export async function productsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const products = await getAllProducts();

  return reply
    .status(200)
    .send({ message: "product retrieved successfully", products });
}

// GET PRODUCT BY ID
export async function productController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = req.params as parameters;
  const product = await getProductById(id);
  if (!product) {
    return reply.status(404).send({ message: "Product not found" });
  }

  return reply
    .status(200)
    .send({ message: "product retrieved successfully", product });
}
