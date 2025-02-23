import { Document } from '../types';

export interface CollectionStore {
  name: string;
  set(values: Document[]): Promise<void>;
  get(id: string): Promise<Document | undefined>;
  getAll(): Promise<Document[]>;
  remove(ids: string[]): Promise<void>;
}

export interface Store {
  getCollection(name: string): Promise<CollectionStore>;
  createCollection(name: string): Promise<CollectionStore>;
  deleteCollection(name: string): Promise<void>;
  getAllCollections(): Promise<CollectionStore[]>;
}
