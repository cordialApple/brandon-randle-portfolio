import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const accent = z.enum(["b", "m", "p", "k"]);

const cases = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/cases" }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    tag: z.string(),
    accent,
    tileTag: z.string(),
    tileNum: z.string(),
    tileImage: z.string().optional(),
    tileAlt: z.string().optional(),
    tileArch: z.boolean().default(false),
    lede: z.string(),
    heroImage: z.string().optional(),
    heroAlt: z.string().optional(),
    heroArch: z.boolean().default(false),
    finding: z.object({ title: z.string(), body: z.string() }).optional(),
    media2: z.object({ image: z.string(), alt: z.string() }).optional(),
    meta: z.array(z.object({ k: z.string(), v: z.string() })).length(3),
    delta: z.object({
      before: z.object({ v: z.string(), label: z.string(), accent: accent.optional() }),
      after: z.object({ v: z.string(), label: z.string(), accent: accent.optional() }),
    }),
    links: z.array(z.object({ label: z.string(), href: z.string() })),
  }),
});

export const collections = { cases };
