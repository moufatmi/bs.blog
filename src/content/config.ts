import { defineCollection, z } from 'astro:content';

const programSchema = z.object({
  title: z.string(),
  description: z.string(),
  image: z.string(),
  price: z.string(),
  duration: z.string(),
  features: z.array(z.string()),
  pdfUrl: z.string().optional(),
  availabilityNote: z.string().optional(),
});

const hajjCollection = defineCollection({
  type: 'content',
  schema: programSchema,
});

const omraCollection = defineCollection({
  type: 'content',
  schema: programSchema,
});

const voyagesCollection = defineCollection({
  type: 'content',
  schema: programSchema,
});

const blogCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        excerpt: z.string(),
        image: z.string(),
        date: z.date(),
        category: z.string(),
    }),
});

export const collections = {
  'hajj': hajjCollection,
  'omra': omraCollection,
  'voyages': voyagesCollection,
  'blog': blogCollection,
}; 