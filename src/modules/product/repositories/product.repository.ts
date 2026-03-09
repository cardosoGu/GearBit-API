import prisma from "#database";
import { updateProductInput } from "../schemas/product.schema";

export async function findUserById(id: string) {
  return await prisma.user.findUnique({ where: { id } });
}

export async function createProduct(
  name: string,
  description: string,
  price: number,
  imageUrl: string,
  stockQuantity: number,
) {
  return await prisma.product.create({
    data: {
      name,
      description,
      price,
      imageUrl,
      stockQuantity,
    },
  });
}

export async function getAllProducts() {
  return await prisma.product.findMany();
}

export async function getProductById(id: string) {
  return await prisma.product.findUnique({ where: { id } });
}

export async function updateProduct(id: string, data: updateProductInput) {
  return await prisma.product.update({
    where: { id },
    data,
  });
}

export async function deleteProduct(id: string) {
  return await prisma.product.delete({ where: { id } })
}
