import { z } from 'zod';
import { publicProcedure, router } from './trpc';
import { getDecisionForNewDocuments, getDecisionForQuery } from './decision';
import { DocumentSchema } from './types';

export const decisionRouter = router({
  getDecisionForNewDocuments: publicProcedure
    .input(
      z.object({
        existingSchema: z.object({}).passthrough(),
        newDocuments: z.array(DocumentSchema),
      })
    )
    .query(async ({ input }) => {
      return getDecisionForNewDocuments(
        input.existingSchema,
        input.newDocuments
      );
    }),
  getDecisionForQuery: publicProcedure
    .input(
      z.object({
        inputSchema: z.object({}).passthrough(),
        targetSchema: z.object({}).passthrough(),
      })
    )
    .query(async ({ input }) => {
      return getDecisionForQuery(input.inputSchema, input.targetSchema);
    }),
});

export type DecisionRouter = typeof decisionRouter;
