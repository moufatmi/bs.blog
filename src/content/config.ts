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

const galleryCollection = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string().optional(),
        mediaUrl: z.string().optional(), // Single image/video URL (for backward compatibility)
        mediaUrls: z.array(z.string()).optional(), // Multiple image URLs
        mediaType: z.enum(['image', 'video', 'carousel']), // Added 'carousel' type
        thumbnailUrl: z.string().optional(), // For video thumbnails or carousel cover
        category: z.string().optional(), // Optional category (hajj-omra, istanbul, etc.)
        location: z.string().optional(), // Location where photo/video was taken
        date: z.date().optional(), // When the media was captured
    }),
});

export const collections = {
  'hajj': hajjCollection,
  'omra': omraCollection,
  'voyages': voyagesCollection,
  'blog': blogCollection,
  'gallery': galleryCollection,
}; 