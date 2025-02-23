import fs from 'fs/promises';
import { Collection, Document } from '../types';
import { CollectionStore, Store } from './store';

class FileCollectionStore implements CollectionStore {
  private collection: Collection;
  private _commit: () => Promise<void>;
  name: string;

  constructor(collection: Collection, commit: () => Promise<void>) {
    this.collection = collection;
    this._commit = commit;
    this.name = collection.name;
  }

  async set(values: Document[]): Promise<void> {
    values.forEach((value) => {
      if (this.collection.documents.some((d) => d._id === value._id)) {
        this.collection.documents = this.collection.documents.map((d) =>
          d._id === value._id ? value : d
        );
      } else {
        this.collection.documents.push(value);
      }
    });
    await this._commit();
  }

  async get(id: string): Promise<Document | undefined> {
    return this.collection.documents.find((d) => d._id === id) as Document;
  }

  async getAll(): Promise<Document[]> {
    return this.collection.documents;
  }

  async remove(ids: string[]): Promise<void> {
    this.collection.documents = this.collection.documents.filter(
      (d) => !ids.includes(d._id)
    );
    await this._commit();
  }

  async commit(): Promise<void> {
    await this._commit();
  }
}

export class FileStore implements Store {
  private readonly dbPath: string;
  private collections: Record<string, Collection> = {};

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.loadDatabase();
  }

  private async loadDatabase(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf8');
      this.collections = JSON.parse(data);
    } catch (error) {
      console.error('Error loading database:', error);
    }
  }

  private async saveFile(): Promise<void> {
    try {
      await fs.writeFile(
        this.dbPath,
        JSON.stringify(this.collections, null, 2)
      );
    } catch (error) {
      console.error('Error saving database:', error);
    }
  }

  async createCollection(name: string): Promise<CollectionStore> {
    if (this.collections[name]) {
      throw new Error(`Collection ${name} already exists`);
    }
    this.collections[name] = { name, documents: [] };
    await this.saveFile();
    return new FileCollectionStore({ name, documents: [] }, this.saveFile);
  }

  async deleteCollection(name: string): Promise<void> {
    delete this.collections[name];
    await this.saveFile();
  }

  async getCollection(name: string): Promise<CollectionStore> {
    const collection = this.collections[name];
    if (!collection) {
      throw new Error(`Collection ${name} not found`);
    }
    return new FileCollectionStore(collection, this.saveFile);
  }

  async getAllCollections(): Promise<CollectionStore[]> {
    return Object.values(this.collections).map(
      (c) => new FileCollectionStore(c, this.saveFile)
    );
  }

  async commit(): Promise<void> {
    await this.saveFile();
  }
}
