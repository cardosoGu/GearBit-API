import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number().positive(),
  imageUrl: z.string().url(),
  stockQuantity: z.number().int().nonnegative(),
});

export const updateProductSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().optional(),
});

export type createProductInput = z.infer<typeof createProductSchema>;
export type updateProductInput = z.infer<typeof updateProductSchema>;
