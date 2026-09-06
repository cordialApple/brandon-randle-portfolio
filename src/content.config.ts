import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "zod";

const media = z.object({ src: z.string(), alt: z.string(), caption: z.string() });
const cases = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/cases" }),
  schema: z.object({
    order: z.number(),
    title: z.string(),
    category: z.string(),
    accent: z.enum(["blue", "pink", "purple", "mint"]),
    summary: z.string(),
    outcome: z.string(),
    stack: z.string(),
    role: z.string(),
    status: z.string(),
    image: media.optional(),
    secondaryImage: media.optional(),
    diagram: z.enum(["production", "platform"]).optional(),
    links: z.array(z.object({ label: z.string(), href: z.url() })).min(1),
  }),
});

export const collections = { cases };
