# Shapeshifter

Shapeshifter is a prototype that utilizes an LLM inside a database for schema flexibility. If a query or new document doesn't match the existing schema, Shapeshifter will reason about whether the query or document's schema is a subtype or supertype of the existing schema. If necessary, it will use an LLM to produce a mapping from the query or document's schema to the existing schema, and possibly migrate existing documents to the new schema.

It consists of a server that exposes a REST API for managing collections, and adding, updating, removing, and querying documents, as well as a UI console. Under the hood, data is stored in a LevelDB database.

## Motivation

Using an LLM inside a database might be a terrible idea! Predictability and reliability are often viewed as essential qualities for a database system, and using an LLM to make decisions would seem to undermine these.

But making databases more resilient to incorrect queries, and more flexible to changing data, without requiring manual migrations, might be desirable. This might be especially relevant in a context where LLMs are being used within larger systems. Often we want to incorporate LLMs within systems in structured ways, but sometimes we don't know up front what the schema is of the data the LLM should produce, or we want want to be flexible and resiliant to LLMs querying the data in ways that don't match the original schema.

## Technologies used

- [zod](https://zod.dev/) for representing schemas
- [jq](https://stedolan.github.io/jq/) for transforming data
- [level](https://leveljs.org/) for data storage
- [mingo](https://github.com/kofrasa/mingo) for MongoDB-like querying
- [quicktype](https://quicktype.io/) for generating code from JSON schemas
- [Vercel's ai sdk](https://sdk.vercel.ai/) for calling LLMs
- [express](https://expressjs.com/) for the web server
- [swagger](https://swagger.io/) for the API documentation
- [React](https://react.dev/) for the frontend
- [Vite](https://vitejs.dev/) for the frontend build

## How it works

### Adding or updating a document

- The user calls Shapeshifter with one or more documents to add or update, along with a set of allowed operations.
- Shapeshifter infers a schema from the collection's existing documents
- It then checks to see if the document's schema is an exact match of the collection's inferred schema, or if it is a subtype or supertype of the collection's inferred schema
- If it is a subtype, and if the caller gave permission to accept subtypes, it will add the document to the collection. The collection's schema will now be updated to make some fields optional, reflecting the fact that the document is a subtype of the collection's schema.
- If the document is a supertype of the collection's schema, an LLM will be called to make a decision whether to
  - accept the document as is, expanding the inferred schema;
  - map the document to the collection's schema, using jq;
  - migrate existing documents to a new schema, using jq; or
  - reject the document
- If the chosen operation is allowed, Shapeshifter will then map or migrate as needed, and update the collection. If the chosen operation is not allowed, it will reject the document.

### Querying a collection

- The user calls Shapeshifter with a query in the form of a shape specified via JSON, an optional filter, and a set of allowed operations.
- Shapeshifter infers a schema from the collection's existing documents
- It then checks to see if the query's shape is an exact match of the collection's inferred schema, or if it is a subtype or supertype of the collection's inferred schema
- If it is a subtype, Shapeshifter will return the documents that match the query, filtering the fields to only the ones that are in the query's shape
- If it is a supertype, an LLM will be called to make a decision whether to
  - map the query to the collection's schema, using jq;
  - reject the query
- If the chosen operation is allowed, Shapeshifter will map existing documents to the query's shape, using jq, and apply the filter.
