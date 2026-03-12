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
import redis from "../../../lib/redis";

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


  if (!product) {
    return reply.status(500).send({ message: "Failed to create product" });
  }

  await redis.del('products')
  await redis.del(`product:${product.id}`)

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

  await redis.del('products')
  await redis.del(`product:${id}`)

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

  await redis.del('products')
  await redis.del(`product:${id}`)

  return reply
    .status(200)
    .send({ message: "Product updated successfully", product: updatedProduct });
}

// GET ALL PRODUCTS
export async function productsController(
  req: FastifyRequest,
  reply: FastifyReply,
) {
  const cached = await redis.get('products')

  if (!cached) {
    const products = await getAllProducts();

    if (!products) {
      return reply
        .status(404)
        .send({ message: "No products avaliable" });
    }

    await redis.set('products', JSON.stringify(products), 'EX', 60 * 60)
    return reply
      .status(200)
      .send({ message: "product retrieved successfully", products });

  }

  const products = JSON.parse(cached)
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
  const cached = await redis.get(`product:${id}`)


  if (!cached) {
    const product = await getProductById(id);

    if (!product) {
      return reply
        .status(404)
        .send({ message: "Product Not Found" });
    }

    await redis.set(`product:${id}`, JSON.stringify(product), 'EX', 60 * 60)
    return reply
      .status(200)
      .send({ message: "product retrieved successfully", product });

  }

  const product = JSON.parse(cached)

  return reply
    .status(200)
    .send({ message: "product retrieved successfully", product });
}
