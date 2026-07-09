import { z } from 'zod';

// Validación de inputs del backend
export const PluginInput = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'slug inválido'),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  author: z.string().max(120).optional(),
  homepage: z.string().url().optional().or(z.literal('')),
  category: z.string().max(60).optional(),
  visibility: z.enum(['public', 'private']).default('private'),
  tags: z.array(z.string().max(40)).max(20).optional(),
  thumbnail: z.string().max(500).optional(),
});

export const VersionInput = z.object({
  slug: z.string().min(2).max(80),
  version: z.string().min(1).max(40).regex(/^[\w.+-]+$/, 'versión inválida'),
  changelog: z.string().max(8000).optional(),
  gameVersion: z.string().max(40).optional(),
  fileName: z.string().min(1).max(200),
  fileSize: z.number().int().min(1).max(200 * 1024 * 1024),
  contentType: z.string().max(100),
  storageBucket: z.enum(['public', 'private']).default('private'),
  storageKey: z.string().min(1).max(500),
  published: z.boolean().default(false),
  downloadCount: z.number().int().min(0).default(0),
});

export const RequestUploadInput = z.object({
  fileName: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1).max(200 * 1024 * 1024),
  bucket: z.enum(['public', 'private']).default('private'),
  context: z.enum(['plugin-jar', 'thumbnail', 'config']).default('plugin-jar'),
  pluginSlug: z.string().min(2).max(80).optional(),
  version: z.string().min(1).max(40).optional(),
});
