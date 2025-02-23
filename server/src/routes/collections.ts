import { z } from 'zod';
import { Database } from '../database';
import { mapping, reject } from '../decision';
import {
  AddDocumentResponseSchema,
  AddDocumentsResponseSchema,
  CollectionSchema,
  DocumentSchema,
} from '../types';
import { createRoute, RouteConfig } from '../types/route';

export function buildRoutes(
  database: Database
): RouteConfig<z.ZodTypeAny, z.ZodTypeAny, z.AnyZodObject, z.AnyZodObject>[] {
  return [
    createRoute({
      id: 'get-collections',
      description: 'Get all collections',
      method: 'get',
      path: '/collections',
      input: z.object({}),
      output: z.array(CollectionSchema),
      summary: 'Get all collections',
      tags: ['Collections'],
      handler: async () => {
        return database.getAllCollections();
      },
    }),

    createRoute({
      id: 'create-collection',
      description: 'Create a new collection',
      method: 'post',
      path: '/collections',
      input: z.object({
        name: z.string(),
      }),
      output: CollectionSchema,
      summary: 'Create a new collection',
      tags: ['Collections'],
      handler: async (data) => {
        return database.createCollection(data.name);
      },
    }),

    createRoute({
      id: 'get-collection',
      description: 'Get a single collection by name',
      method: 'get',
      path: '/collections/:collection',
      input: z.object({}),
      params: z.object({
        collection: z.string(),
      }),
      output: CollectionSchema,
      summary: 'Get a single collection by name',
      tags: ['Collections'],
      handler: async (_, params) => {
        return database.getCollection(params.collection);
      },
    }),

    createRoute({
      id: 'get-collection-schema',
      description: 'Get JSON schema for a collection',
      method: 'get',
      path: '/collections/:collection/schema',
      input: z.object({}),
      params: z.object({
        collection: z.string(),
      }),
      output: z.union([z.object({}).passthrough(), z.string()]),
      query: z.object({
        language: z.string().optional(),
      }),
      summary: 'Get JSON schema for a collection',
      tags: ['Collections'],
      handler: async (_, params, query) => {
        const schema = await database.getCollectionSchema(
          params.collection,
          query.language
        );
        return schema;
      },
    }),

    createRoute({
      id: 'query-documents',
      description: 'Query documents in a collection',
      method: 'get',
      path: '/collections/:collection/documents',
      input: z.object({}),
      params: z.object({
        collection: z.string(),
      }),
      query: z
        .object({
          limit: z.string().optional(),
          sort: z.enum(['asc', 'desc']).optional(),
        })
        .passthrough(),
      output: z.object({
        documents: z.array(DocumentSchema),
        operation: z.union([mapping, reject]).optional(),
      }),
      summary: 'Query documents in a collection',
      tags: ['Documents'],
      handler: async (_, params, query) => {
        return await database.queryDocuments(params.collection, query, {});
      },
    }),

    createRoute({
      id: 'query-documents-by-shape',
      description: 'Query documents in a collection',
      method: 'post',
      path: '/collections/:collection/documents/query',
      input: z.object({
        shape: DocumentSchema.omit({ _id: true }),
        filter: z.object({}).passthrough().optional(),
      }),
      params: z.object({
        collection: z.string(),
      }),
      query: z
        .object({
          limit: z.string().optional(),
          sort: z.enum(['asc', 'desc']).optional(),
          allowed: z.string().optional(),
        })
        .passthrough(),
      output: z.object({
        documents: z.array(DocumentSchema),
        operation: z.union([mapping, reject]).optional(),
      }),
      summary: 'Query documents in a collection',
      tags: ['Documents'],
      handler: async ({ shape, filter }, params, query) => {
        return await database.queryDocuments(
          params.collection,
          query ? { limit: query.limit, sort: query.sort } : {},
          shape,
          filter,
          query.allowed !== undefined ? query.allowed.split(',') : undefined
        );
      },
    }),

    createRoute({
      id: 'get-document',
      description: 'Get a single document by ID',
      method: 'get',
      path: '/collections/:collection/documents/:documentId',
      input: z.object({}),
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
      output: DocumentSchema,
      summary: 'Get a single document by ID',
      tags: ['Documents'],
      handler: async (_, params) => {
        return database.getDocument(params.collection, params.documentId);
      },
    }),

    createRoute({
      id: 'create-document',
      description: 'Create a new document',
      method: 'post',
      path: '/collections/:collection/documents',
      input: DocumentSchema.omit({ _id: true }),
      params: z.object({
        collection: z.string(),
      }),
      query: z
        .object({
          allowed: z.string().optional(),
        })
        .passthrough(),
      output: AddDocumentResponseSchema,
      summary: 'Create a new document',
      tags: ['Documents'],
      handler: async (data, params, query) => {
        return database.addDocument(
          params.collection,
          data,
          query.allowed !== undefined ? query.allowed.split(',') : undefined
        );
      },
    }),

    createRoute({
      id: 'create-documents',
      description: 'Create multiple documents',
      method: 'post',
      path: '/collections/:collection/documents/batch',
      input: z.array(DocumentSchema.omit({ _id: true })),
      params: z.object({
        collection: z.string(),
      }),
      query: z
        .object({
          allowed: z.string().optional(),
        })
        .passthrough(),
      output: AddDocumentsResponseSchema,
      summary: 'Create multiple documents',
      tags: ['Documents'],
      handler: async (data, params, query) => {
        return await database.addDocuments(
          params.collection,
          data,
          query.allowed !== undefined ? query.allowed.split(',') : undefined
        );
      },
    }),

    createRoute({
      id: 'update-document',
      description: 'Update a document partially',
      method: 'patch',
      path: '/collections/:collection/documents/:documentId',
      input: DocumentSchema.partial().omit({ _id: true }),
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
      output: DocumentSchema,
      summary: 'Update a document partially',
      tags: ['Documents'],
      handler: async (data, params) => {
        return database.updateDocument(
          params.collection,
          params.documentId,
          data
        );
      },
    }),

    createRoute({
      id: 'replace-document',
      description: 'Replace a document completely',
      method: 'put',
      path: '/collections/:collection/documents/:documentId',
      input: DocumentSchema.omit({ _id: true }),
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
      output: DocumentSchema,
      summary: 'Replace a document completely',
      tags: ['Documents'],
      handler: async (data, params) => {
        return database.replaceDocument(
          params.collection,
          params.documentId,
          data
        );
      },
    }),

    createRoute({
      id: 'delete-document',
      description: 'Delete a document',
      method: 'delete',
      path: '/collections/:collection/documents/:documentId',
      input: z.object({}),
      params: z.object({
        collection: z.string(),
        documentId: z.string(),
      }),
      output: z.object({}),
      summary: 'Delete a document',
      tags: ['Documents'],
      handler: async (_, params) => {
        await database.deleteDocument(params.collection, params.documentId);
        return {};
      },
    }),

    createRoute({
      id: 'delete-documents',
      description: 'Delete multiple documents',
      method: 'delete',
      path: '/collections/:collection/documents',
      input: z.object({
        documentIds: z.array(z.string()),
      }),
      params: z.object({
        collection: z.string(),
      }),
      output: z.object({}),
      summary: 'Delete multiple documents',
      tags: ['Documents'],
      handler: async (data, params) => {
        await database.deleteDocuments(params.collection, data.documentIds);
        return {};
      },
    }),
  ];
}

export default buildRoutes;
