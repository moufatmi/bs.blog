import { defineCollection, z } from 'astro:content';

const programsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    price: z.string(),
    duration: z.string(),
    features: z.array(z.string()),
    type: z.enum(['hajj', 'omra', 'voyage']),
    pdfUrl: z.string().optional(),
    availabilityNote: z.string().optional(),
  }),
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
  'programs': programsCollection,
  'blog': blogCollection,
}; 