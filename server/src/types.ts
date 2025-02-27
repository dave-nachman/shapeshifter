import { z } from 'zod';
import { DecisionSchema, Mapping, Reject } from './decision';

export const DocumentSchema = z
  .object({
    _id: z.string(),
  })
  .passthrough();

export type Document = z.infer<typeof DocumentSchema>;

export const AddDocumentResponseSchema = z.object({
  document: DocumentSchema.optional(),
  operation: DecisionSchema.optional(),
});

export type AddDocumentResponse = z.infer<typeof AddDocumentResponseSchema>;

export const AddDocumentsResponseSchema = z.object({
  documents: z.array(DocumentSchema).optional(),
  operation: DecisionSchema.optional(),
});

export type AddDocumentsResponse = z.infer<typeof AddDocumentsResponseSchema>;

export const CollectionSchema = z.object({
  name: z.string(),
  documents: z.array(DocumentSchema),
});

export type Collection = z.infer<typeof CollectionSchema>;

export const QueryParamsSchema = z
  .object({
    limit: z.string().optional(),
    sort: z.string().optional(),
  })
  .passthrough();

export type QueryParams = z.infer<typeof QueryParamsSchema>;

export interface QueryDocumentsResponse {
  documents: Document[];
  operation?: Mapping | Reject;
}
