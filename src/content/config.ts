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
  destination: z.string().optional(),
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
    title: z.string().optional(),
    excerpt: z.string().optional(),
    image: z.string().optional(),
    date: z.date().optional(),
    category: z.string().optional(),
  }),
});

const galleryCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    media: z.discriminatedUnion('discriminant', [
      z.object({ discriminant: z.literal('image-local'), value: z.string() }),
      z.object({ discriminant: z.literal('image-external'), value: z.string() }),
      z.object({ discriminant: z.literal('video-local'), value: z.string() }),
      z.object({ discriminant: z.literal('video-external'), value: z.string() }),
      z.object({ discriminant: z.literal('carousel'), value: z.array(z.string()) }),
    ]),
    thumbnailUrl: z.string().optional(),
    category: z.string().optional(),
    location: z.string().optional(),
    date: z.date().optional(),
  }),
});

export const collections = {
  'hajj': hajjCollection,
  'omra': omraCollection,
  'voyages': voyagesCollection,
  'blog': blogCollection,
  'gallery': galleryCollection,
};