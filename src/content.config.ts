import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const stepSchema = z.object({
  step: z.number(),
  title: z.string(),
  summary: z.string(),
  tip: z.string().optional().default(''),
});

const faqSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

const ingredientSchema = z.object({
  amount: z.number(),
  unit: z.string(),
  item: z.string(),
});

const calcRowSchema = z.object({
  label: z.string(),
  value: z.string(),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.string(),
    heroImage: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    readingTime: z.number().optional().default(6),
    keyTakeaways: z.array(z.string()).default([]),
    steps: z.array(stepSchema).default([]),
    faqs: z.array(faqSchema).default([]),
    // Fintech / Rechner fields
    savingPotential: z.string().optional().default(''),
    exampleCalculation: z.array(calcRowSchema).default([]),
    // Food / Recipe fields
    servings: z.number().optional(),
    prepMinutes: z.number().optional(),
    calories: z.string().optional().default(''),
    costPerServing: z.string().optional().default(''),
    ingredients: z.array(ingredientSchema).default([]),
    // Diagnostic / Fehlercode fields
    errorCodes: z.array(z.string()).default([]),
    brands: z.string().optional().default(''),
    selfFixLevel: z.string().optional().default(''),
    timeRequired: z.string().optional().default(''),
    savedCost: z.string().optional().default(''),
  }),
});

export const collections = { articles };
