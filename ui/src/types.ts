export interface Collection {
  name: string;
  documents: Document[];
}

export interface Document {
  _id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface QueryResult {
  documents: Document[];
  operation?: {
    type: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}
