import { AbstractLevel, AbstractSublevel } from 'abstract-level';
import { Document } from '../types';
import { CollectionStore, Store } from './store';

type Level = AbstractSublevel<
  AbstractLevel<string | Buffer | Uint8Array, string, Document>,
  string | Buffer | Uint8Array,
  string,
  Document
>;

class LevelCollectionStore implements CollectionStore {
  private level: Level;
  name: string;

  constructor(name: string, level: Level) {
    this.name = name;
    this.level = level;
  }

  async set(values: Document[]): Promise<void> {
    await this.level.batch(
      values.map((value) => ({
        type: 'put',
        key: value._id,
        value,
      }))
    );
  }

  async get(id: string): Promise<Document | undefined> {
    return await this.level.get(id);
  }

  async getAll(): Promise<Document[]> {
    const results = [];
    for await (const value of this.level.values()) {
      results.push(value);
    }
    return results;
  }

  async remove(ids: string[]): Promise<void> {
    await this.level.batch(ids.map((id) => ({ type: 'del', key: id })));
  }
}

export class LevelStore implements Store {
  private level: AbstractLevel<string | Buffer | Uint8Array, string, Document>;
  private collectionMetadata: AbstractSublevel<
    AbstractLevel<string | Buffer | Uint8Array, string, Document>,
    string | Buffer | Uint8Array,
    string,
    { name: string }
  >;

  constructor(
    level: AbstractLevel<string | Buffer | Uint8Array, string, Document>
  ) {
    this.level = level;
    this.level.open();
    this.collectionMetadata = level.sublevel<string, { name: string }>(
      '__collections',
      {
        keyEncoding: 'utf8',
        valueEncoding: 'json',
      }
    );
  }

  async getCollection(name: string): Promise<CollectionStore> {
    const collectionMetadata = await this.collectionMetadata.get(name);
    if (!collectionMetadata) {
      throw new Error(`Collection ${name} not found`);
    }

    return new LevelCollectionStore(
      name,
      this.level.sublevel<string, Document>(name, {
        keyEncoding: 'utf8',
        valueEncoding: 'json',
      })
    );
  }

  async createCollection(name: string): Promise<CollectionStore> {
    await this.collectionMetadata.put(name, { name });
    return new LevelCollectionStore(
      name,
      this.level.sublevel<string, Document>(name, {
        keyEncoding: 'utf8',
        valueEncoding: 'json',
      })
    );
  }

  async getAllCollections(): Promise<CollectionStore[]> {
    const names = await this.collectionMetadata.keys();
    const results = [];
    for await (const name of names) {
      results.push(await this.getCollection(name));
    }
    return results;
  }

  async deleteCollection(name: string): Promise<void> {
    await this.collectionMetadata.del(name);
  }
}
