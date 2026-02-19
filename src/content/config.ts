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
    mediaUrl: z.string().optional(), // Single image/video URL (for backward compatibility)
    videoFile: z.string().optional(), // Uploaded video file (path)
    galleryImages: z.array(z.string()).optional(), // Uploaded gallery images (paths)
    mediaUrls: z.array(z.string()).optional(), // Multiple image URLs (manual entry)
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