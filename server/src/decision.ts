import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';
import { Document } from './types';

export const mapping = z.object({
  type: z.literal('map'),
  jqMappingCommandPerDocument: z.string(),
});

export type Mapping = z.infer<typeof mapping>;

export const migrate = z.object({
  type: z.literal('migrate'),
  newSchema: z.object({}),
  jqMappingCommandPerDocumentFromOldToNewSchema: z.string(),
});

export type Migrate = z.infer<typeof migrate>;

export const reject = z.object({
  type: z.literal('reject'),
  message: z.string(),
});

export type Reject = z.infer<typeof reject>;

const isSubset = z.object({
  type: z.literal('isSubset'),
});

const isSuperset = z.object({
  type: z.literal('isSuperset'),
});

export const DecisionSchema = z.union([
  mapping,
  reject,
  isSubset,
  isSuperset,
  migrate,
]);

export type Decision = z.infer<typeof DecisionSchema>;

export async function getDecisionForNewDocuments(
  existingSchema: object,
  newDocuments: Document[]
): Promise<Decision> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-20240620'),
    schema: z.object({ decision: DecisionSchema }),
    prompt: `
You are serving as a data migration assistant for a database.

A user is trying to add new documents to a collection, but the documents don't match the existing schema.

You need to decide how to handle the new documents:
- If the new documents are very different from the existing schema, you should reject them.
- If the new documents are a subset of the existing schema, then return "isSubset".
- If the new documents are a superset of the existing schema, then return "isSuperset".
- If the new documents generalize the existing schema, then use "migrate" to refactor the existing documents to match the new schema.
  - The command should capture how to transform the existing documents to match the new input, e.g. converting a string to be an array of strings.
  - Don't use "if" in your jq command.
- Otherwise, you should map the new documents to the existing schema.


The existing schema is ${JSON.stringify(existingSchema)}.
The new documents are ${JSON.stringify(
      newDocuments.map((doc) => ({
        ...doc,
        _id: undefined,
        _original: undefined,
      }))
    )}.
        `,
  });

  return object.decision;
}

export async function getDecisionForQuery(
  inputSchema: object,
  targetSchema: object
): Promise<Mapping | Reject> {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  const { object } = await generateObject({
    model: anthropic('claude-3-5-sonnet-20240620'),
    schema: z.object({ decision: z.union([mapping, reject]) }),
    prompt: `
    You are serving as a data migration assistant for a database.

    A user is trying to query a collection with a shape that doesn't match the collection's schema. Please help them by mapping the shape to the schema.

    The input schema is ${JSON.stringify(inputSchema)}.
    The target schema is ${JSON.stringify(targetSchema)}.

    You need to decide how to map the input schema to the target schema.

    If it is not possible to map the input schema to the target schema, then return "reject".
    `,
  });
  return object.decision;
}

export interface Decider {
  getDecisionForNewDocuments: (
    existingSchema: object,
    newDocuments: Document[]
  ) => Promise<Decision>;
  getDecisionForQuery: (
    inputSchema: object,
    targetSchema: object
  ) => Promise<Mapping | Reject>;
}
