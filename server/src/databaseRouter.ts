import { z } from 'zod';
import { publicProcedure, router } from './trpc';
import { Database } from './database';
import { LevelStore } from './stores/level';
import { Level } from 'level';
import { Document } from './types';

let database: Database;

try {
  database = new Database(
    new LevelStore(
      new Level<string, Document>('db', {
        valueEncoding: 'json',
        keyEncoding: 'utf8',
      })
    )
  );
} catch (error) {
  console.error(error);
}

export const databaseRouter = router({
  getCollections: publicProcedure.query(async () => {
    return database.getAllCollections();
  }),
  createCollection: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      return database.createCollection(input.name);
    }),
  getCollection: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      return database.getCollection(input.name);
    }),
  getCollectionSchema: publicProcedure
    .input(z.object({ name: z.string(), language: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      return database.getCollectionSchema(input.name, input.language);
    }),
  getCollectionJsonSchema: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      return database.getCollectionJsonSchema(input.name);
    }),
  queryDocuments: publicProcedure
    .input(
      z.object({
        name: z.string(),
        shape: z.object({}).passthrough(),
        filter: z.object({}).passthrough().optional(),
        allowedOperations: z
          .array(z.enum(['map', 'isSubset', 'isSuperset', 'migrate']))
          .optional(),
      })
    )
    .query(async (opts) => {
      const { input, ctx } = opts;
      const result = await database.queryDocuments(
        input.name,
        {},
        input.shape,
        input.filter ?? {},
        input.allowedOperations ?? [],
        ctx.decider
      );
      return result;
    }),
  getDocument: publicProcedure
    .input(z.object({ name: z.string(), documentId: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      return database.getDocument(input.name, input.documentId);
    }),
  addDocument: publicProcedure
    .input(
      z.object({
        name: z.string(),
        document: z.object({}).passthrough(),
        allowedOperations: z
          .array(z.enum(['map', 'isSubset', 'isSuperset', 'migrate']))
          .optional(),
      })
    )
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      return database.addDocument(
        input.name,
        input.document,
        input.allowedOperations ?? [],
        ctx.decider
      );
    }),
  addDocuments: publicProcedure
    .input(
      z.object({
        name: z.string(),
        documents: z.array(z.object({})),
        allowedOperations: z
          .array(z.enum(['map', 'isSubset', 'isSuperset', 'migrate']))
          .optional(),
      })
    )
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      return database.addDocuments(
        input.name,
        input.documents,
        input.allowedOperations ?? [],
        ctx.decider
      );
    }),
  updateDocument: publicProcedure
    .input(
      z.object({
        name: z.string(),
        documentId: z.string(),
        document: z.object({}).passthrough(),
        allowedOperations: z
          .array(z.enum(['map', 'isSubset', 'isSuperset', 'migrate']))
          .optional(),
      })
    )
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      return database.updateDocument(
        input.name,
        input.documentId,
        input.document,
        input.allowedOperations ?? [],
        ctx.decider
      );
    }),
  replaceDocument: publicProcedure
    .input(
      z.object({
        name: z.string(),
        documentId: z.string(),
        document: z.object({}).passthrough(),
        allowedOperations: z
          .array(z.enum(['map', 'isSubset', 'isSuperset', 'migrate']))
          .optional(),
      })
    )
    .mutation(async (opts) => {
      const { input, ctx } = opts;
      return database.replaceDocument(
        input.name,
        input.documentId,
        input.document,
        input.allowedOperations ?? [],
        ctx.decider
      );
    }),
  deleteDocument: publicProcedure
    .input(z.object({ name: z.string(), documentId: z.string() }))
    .mutation(async (opts) => {
      const { input } = opts;
      return database.deleteDocument(input.name, input.documentId);
    }),
  deleteDocuments: publicProcedure
    .input(z.object({ name: z.string(), documentIds: z.array(z.string()) }))
    .mutation(async (opts) => {
      const { input } = opts;
      return database.deleteDocuments(input.name, input.documentIds);
    }),
});

export type DatabaseRouter = typeof databaseRouter;
