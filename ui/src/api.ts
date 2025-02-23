import axios from "axios";
import { Collection, Document, QueryResult } from "./types";

const API_URL = "http://localhost:3000/api/v1";

export const api = {
  async getCollections(): Promise<Collection[]> {
    const response = await axios.get(`${API_URL}/collections`);
    return response.data;
  },

  async createCollection(name: string): Promise<Collection> {
    const response = await axios.post(`${API_URL}/collections`, { name });
    return response.data;
  },

  async queryDocuments(
    collection: string,
    shape: object,
  ): Promise<QueryResult> {
    const response = await axios.post(
      `${API_URL}/collections/${collection}/documents/query`,
      shape,
    );
    return response.data;
  },

  async addDocument(
    collection: string,
    document: Omit<Document, "_id">,
  ): Promise<Document> {
    const response = await axios.post(
      `${API_URL}/collections/${collection}/documents`,
      document,
    );
    return response.data;
  },
};
