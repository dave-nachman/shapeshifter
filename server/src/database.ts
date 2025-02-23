import { generateMock } from '@anatine/zod-mock';
import jsonSchemaToZod, { JsonSchemaObject } from 'json-schema-to-zod';
import { mapValues, pick, range } from 'lodash';
import { Query } from 'mingo';
import { AnyObject } from 'mingo/dist/types/types';
import * as jq from 'node-jq';
import {
  InputData,
  jsonInputForTargetLanguage,
  quicktype,
} from 'quicktype-core';
import { uuidv7 } from 'uuidv7';
import {
  Decision,
  getAddDecision,
  getMappingCommand,
  Mapping,
  Migrate,
  Reject,
} from './decision';
import { Store } from './stores/store';
import {
  AddDocumentResponse,
  AddDocumentsResponse,
  Collection,
  Document,
  QueryParamsSchema,
} from './types';

export class Database {
  private store: Store;

  constructor(store: Store) {
    this.store = store;
  }

  async getAllCollections(): Promise<Collection[]> {
    const collections = await this.store.getAllCollections();
    return Promise.all(
      collections.map(async (c) => {
        return {
          name: c.name,
          documents: await c.getAll(),
        };
      })
    );
  }

  async createCollection(name: string): Promise<Collection> {
    const newCollection = await this.store.createCollection(name);
    return {
      name: newCollection.name,
      documents: await newCollection.getAll(),
    };
  }

  async getCollection(name: string): Promise<Collection> {
    const collection = await this.store.getCollection(name);
    if (!collection) {
      throw new Error('Collection not found');
    }
    return {
      name: collection.name,
      documents: await collection.getAll(),
    };
  }

  _extractSchema(schema: object): JsonSchemaObject {
    // @ts-expect-error cast
    return Object.values(schema['definitions'])[0];
  }

  async _isSubset(a: object, b: object) {
    try {
      const az = eval(
        jsonSchemaToZod(this._extractSchema(a), {
          module: 'cjs',
        })
      ).passthrough();
      const bz = eval(
        jsonSchemaToZod(this._extractSchema(b), {
          module: 'cjs',
        })
      ).passthrough();

      const testData = range(100).map(() => generateMock(bz));
      return testData.every((test) => az.safeParse(test).success);
    } catch (error) {
      console.error('Error checking if subset:', error);
      return false;
    }
  }

  async _getSchema(
    name: string,
    documents: object[],
    targetLanguage?: string
  ): Promise<object | string> {
    const jsonInput = jsonInputForTargetLanguage(targetLanguage ?? 'schema');
    await jsonInput.addSource({
      name: name,
      samples: documents.map((doc) =>
        JSON.stringify({ ...doc, _id: undefined, _original: undefined })
      ),
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);
    const result = await quicktype({
      inputData,
      lang: targetLanguage ?? 'schema',
      rendererOptions: {
        'just-types': true,
      },
    });
    if (targetLanguage === 'schema' || targetLanguage === undefined) {
      return JSON.parse(result.lines.join('\n'));
    }
    return result.lines.join('\n');
  }
  async _getJsonSchema(name: string, documents: object[]) {
    return (await this._getSchema(name, documents, 'schema')) as object;
  }
  async getCollectionSchema(
    name: string,
    targetLanguage?: string
  ): Promise<object | string> {
    return this._getSchema(
      name,
      (await this.getCollection(name)).documents,
      targetLanguage
    );
  }
  async getCollectionJsonSchema(name: string) {
    return this._getJsonSchema(
      name,
      (await this.getCollection(name)).documents
    );
  }

  async queryDocuments(
    collectionName: string,
    queryParams: unknown,
    shape: object,
    filter?: object,
    allowedOperations?: ('map' | 'isSubset' | 'isSuperset')[]
  ): Promise<{ documents: Document[]; operation?: Mapping | Reject }> {
    const collection = await this.getCollection(collectionName);
    let documents: Document[] = collection.documents;

    let operation: Mapping | Reject | undefined = undefined;

    if (Object.keys(shape).length > 0) {
      const schema = await this.getCollectionJsonSchema(collectionName);

      const shapeSchema = await this._getJsonSchema(collectionName, [shape]);

      const isSubset = await this._isSubset(shapeSchema, schema);

      if (isSubset) {
        const keys = Object.keys(
          this._extractSchema(shapeSchema).properties || {}
        );
        documents = documents.map((doc) =>
          pick(doc, [...keys, '_id'])
        ) as Document[];
      } else {
        operation = await getMappingCommand(schema, shapeSchema);
        if (
          allowedOperations &&
          operation.type !== 'reject' &&
          !allowedOperations.includes(operation.type)
        ) {
          throw new Error('Operation not allowed');
        }

        if (operation.type === 'map') {
          const mappedDocuments = await Promise.all(
            collection.documents.map(async (doc) => {
              const mapped = await jq.run(
                (operation as Mapping).jqMappingCommandPerDocument,
                doc as unknown as string,
                {
                  input: 'json',
                }
              );
              return mapped;
            })
          );
          documents = mappedDocuments.map((doc, index) => ({
            ...Object.fromEntries(
              Object.entries(
                typeof doc === 'object' ? doc : JSON.parse(doc)
              ).filter(([key]) => {
                return [...Object.keys(shape), '_id'].includes(key);
              })
            ),
            _id: collection.documents[index]._id,
          })) as Document[];
        }
      }
    }

    const validatedParams = QueryParamsSchema.parse(queryParams);
    let results = [...documents];

    // Apply field filters
    Object.entries(validatedParams).forEach(([key, value]) => {
      if (key !== 'limit' && key !== 'sort') {
        results = results.filter((doc) => doc[key]?.toString() === value);
      }
    });

    // Apply sort
    if (validatedParams.sort) {
      const sortOrder = validatedParams.sort.toLowerCase();
      results.sort((a, b) => {
        if (a._id < b._id) return sortOrder === 'desc' ? 1 : -1;
        if (a._id > b._id) return sortOrder === 'desc' ? -1 : 1;
        return 0;
      });
    }

    // Apply limit
    if (validatedParams.limit) {
      const limit = parseInt(validatedParams.limit);
      results = results.slice(0, limit);
    }

    if (filter) {
      const query = new Query(filter as AnyObject);
      results = results.filter((doc) => query.test(doc));
    }

    return {
      documents: operation?.type === 'reject' ? [] : results,
      operation,
    };
  }

  async getDocument(
    collectionName: string,
    documentId: string
  ): Promise<Document> {
    const collection = await this.getCollection(collectionName);
    const document = collection.documents.find((d) => d._id === documentId);
    if (!document) {
      throw new Error('Document not found');
    }
    return document;
  }

  async addDocument(
    collectionName: string,
    data: Record<string, unknown>,
    allowedOperations?: ('map' | 'isSubset' | 'isSuperset')[]
  ): Promise<AddDocumentResponse> {
    const result = await this.addDocuments(
      collectionName,
      [data],
      allowedOperations
    );
    return {
      document: result.documents?.[0],
      operation: result.operation,
    };
  }

  async addDocuments(
    collectionName: string,
    documents: Omit<Document, '_id'>[],
    allowedOperations?: ('map' | 'isSubset' | 'isSuperset' | 'migrate')[]
  ): Promise<AddDocumentsResponse> {
    const collection = await this.store.getCollection(collectionName);
    const newDocuments = documents.map((doc) => ({
      _id: uuidv7(),
      ...doc,
    }));

    const currentSchema = await this.getCollectionJsonSchema(collectionName);
    const newSchema = await this._getJsonSchema(collectionName, newDocuments);

    let decision: Decision | undefined = undefined;

    const existingDocuments = await collection.getAll();

    const isSubset =
      existingDocuments.length === 0 ||
      (await this._isSubset(newSchema, currentSchema));
    const isSuperset =
      documents.length === 0 ||
      (await this._isSubset(currentSchema, newSchema));

    let mappedDocuments: Document[] = newDocuments;
    if (!isSubset && !isSuperset) {
      decision = await getAddDecision(currentSchema, newDocuments);

      if (
        allowedOperations &&
        decision?.type !== 'reject' &&
        !allowedOperations.includes(decision?.type)
      ) {
        throw new Error('Operation not allowed');
      }

      switch (decision?.type) {
        case 'reject':
          break;
        case 'isSubset':
          await collection.set(newDocuments);
          break;
        case 'isSuperset':
          await collection.set(newDocuments);
          break;
        case 'map': {
          const mapped = await Promise.all(
            newDocuments.map(async (doc) => {
              const mapped = await jq.run(
                (decision as Mapping).jqMappingCommandPerDocument,
                doc,
                {
                  input: 'json',
                }
              );
              return mapped;
            })
          );
          mappedDocuments = (mapped as (object | string)[]).map(
            (doc, index) => ({
              _id: newDocuments[index]._id,
              _original: newDocuments[index],
              ...(typeof doc === 'object' ? doc : JSON.parse(doc)),
            })
          );
          await collection.set(mappedDocuments);
          break;
        }
        case 'migrate': {
          if (isSuperset) {
            await Promise.all(
              newDocuments.map(async (doc) => {
                await collection.set([doc]);
              })
            );
            decision = {
              type: 'isSuperset',
            };
          } else {
            const migrated = await Promise.all(
              existingDocuments.map(async (doc) => {
                const migrated = await jq.run(
                  (decision as Migrate)
                    .jqMappingCommandPerDocumentFromOldToNewSchema,
                  // @ts-expect-error cast
                  doc,
                  {
                    input: 'json',
                  }
                );
                return migrated;
              })
            );

            const migratedDocuments = (migrated as (object | string)[]).map(
              (doc, index) =>
                mapValues({
                  _id: existingDocuments[index]._id,
                  _original: existingDocuments[index],
                  ...mapValues(
                    typeof doc === 'object' ? doc : JSON.parse(doc),
                    (value, key) =>
                      existingDocuments[index][key] === undefined &&
                      value === null
                        ? undefined
                        : value
                  ),
                })
            ) as Document[];
            await collection.set(migratedDocuments);
            break;
          }
        }
      }
    } else {
      if (existingDocuments.length === 0) {
        decision = undefined;
      } else if (isSubset) {
        decision = {
          type: 'isSubset',
        };
      } else if (isSuperset) {
        decision = {
          type: 'isSuperset',
        };
      }
      if (
        allowedOperations &&
        decision &&
        !allowedOperations.includes(decision?.type as 'isSubset' | 'isSuperset')
      ) {
        if (decision.type === 'isSubset') {
          throw new Error(
            "The input document's schema is a subset of the collection's schema, but subsets are not allowed"
          );
        } else {
          throw new Error(
            "The input document's schema is a superset of the collection's schema, but supersets are not allowed"
          );
        }
      }
      await collection.set(mappedDocuments);
    }

    return {
      documents: decision?.type === 'reject' ? undefined : mappedDocuments,
      operation: decision,
    };
  }

  async updateDocument(
    collectionName: string,
    documentId: string,
    data: Omit<Document, '_id'>
  ): Promise<Document> {
    const collection = await this.store.getCollection(collectionName);
    const document = await this.getDocument(collectionName, documentId);
    const newDocument = { ...document, ...data };
    await collection.set([newDocument]);
    return newDocument;
  }

  async replaceDocument(
    collectionName: string,
    documentId: string,
    data: Omit<Document, '_id'>
  ): Promise<Document> {
    const collection = await this.store.getCollection(collectionName);
    const newDocument = { _id: documentId, ...data };
    await collection.set([newDocument]);
    return newDocument;
  }

  async deleteDocument(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    const collection = await this.store.getCollection(collectionName);
    await collection.remove([documentId]);
  }

  async deleteDocuments(
    collectionName: string,
    documentIds: string[]
  ): Promise<void> {
    const collection = await this.store.getCollection(collectionName);
    await collection.remove(documentIds);
  }
}
