# Shapeshifter

Shapeshifter is a playful provocation: What if you use an LLM inside a database to enable the database to ["self-drive"](https://www.cs.cmu.edu/~pavlo/blog/2018/04/what-is-a-self-driving-database-management-system.html) schema evolution and query transformations?

Explicit schemas are often a desirable feature in databases, but schemas come with friction. Migrations can be cumbersome. Even for schema-less databases, querying data in a different shape often requires awkward mappings. Resilience to minor mistakes in queries or input data is limited.

LLMs are already being used outside of databases to create a more flexible interface between users and databases—for example, translating natural language into SQL. Shapeshifter explores using LLMs for this purpose as not a separate layer but as a first-class feature of the database itself.

Shapeshifter was presented in a [HYTRADBOI](https://www.hytradboi.com/) (Have you tried rubbing a database on it?) 2025 [lightening talk](https://www.hytradboi.com/2025/0e959091-26f0-43fa-87e0-b2c1e4536f6b-shapeshifter-using-llms-inside-a-database-for-schema-flexibility).

## Try it out

Try out Shapeshifter in an [online playground](https://shapeshifter.davenachman.com/).

## What it is

Shapeshifter is an early stage prototype of a document store that uses an LLM for schema flexibility. It isn't schema-less, but explores turning schemas into something that can be evolved dynamically by the database itself. Shapeshifter computes a schema for the current set of documents in a collection. When a query or incoming document is received, Shapeshifter analyzes its relationship to the existing schema:

- **Exact match**: The request is executed directly, without transformation or use of LLMs.
- **Subtype**: If the request's schema is a subtype of the the existing one, it can be processed without transformation. The schema is updated (e.g. making previously required fields optional).
- **Supertype**: If the request expects a more general (i.e. different) schema, an LLM is invoked to determine the best course of action:
  - **For queries**: The LLM can map existing documents to the requested schema.
  - **For inserts/updates**: The LLM considers multiple strategies, depending on what the caller allows:
    - Mapping incoming documents to the existing schema.
    - Loosening the schema to accommodate new or differing fields while keeping previous documents unchanged.
    - Migrating existing documents to align with a new schema inferred from the request.

The LLM can also reject the request outright if there is no reasonable allowed transformation. The caller specifies which of these transformation operations is allowed.

In the future, Shapeshifter should also be able to create indexes and views, and should potentially make decisions based not only the current new documents or query, but also on based on the history of requests.

MongoDB is an example of a document store offering flexibility around [schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/)—e.g. you can optionally specify a JSON schema for a collection. Shapeshifter insteads internally owns decision-making about validation and migration as data changes.

## Motivation

LLMs are increasingly being integrated into larger systems, often being wrapped in typed interfaces (e.g. ["Pydantic is all you need"](https://www.youtube.com/watch?v=yj-wSRJwrrc)). Having data stored in a particular format and only accepting new data that matches that format introduces rigidity:

- When integrating LLMs into structured systems, we often want their outputs to conform to a schema.
- However, we don’t always know the exact schema upfront, particularly when using LLMs in dynamic use cases where the human user at runtime might be bringing their own particular domain.
- If we allow LLMs to query structured data, it might be desirable to allow them to get the data exactly in the shape it wants, as well as not necessarily needing to tell it what the schema is.
- We might want our database system to be resilient to the LLM making mistakes in using the schema, without needing to add a separate error handling layer.
- As LLMs are used in more dynamic and agentic ways, schema management and migration may become more of a pain point, and other solutions such as using an LLM at runtime to write code for schema migrations might be undesirable.

Shapeshifter is inspired in part by [the robustness principle](https://en.wikipedia.org/wiki/Robustness_principle) (Postel's Law):

> _"Be conservative in what you do, be liberal in what you accept from others."_

What if databases were flexible in how they interpret inputs—adapting queries and data transformations where possible while maintaining consistency, using computed schemas as the basis for decision-making?

There are of course some potential drawbacks:

- Predictability: Databases are expected to be deterministic and free from opaque decision-making.
- Performance: LLMs are slow when invoked, and the possibility that an LLM will be called adds unpredictability to performance expectations.

But for dynamic systems, we might introduce this layer of flexibility any way—maybe the database itself should own and create a user experience around interpreting and transforming data. Over time, LLM performance and predictability will improve, reducing these drawbacks.

Bret Victor discusses the idea of programs that can negotiate and collaborate with each other in his [The Future of Programming](https://worrydream.com/dbx/) talk:

> “They [two programs] need to negotiate with each other. They have to probe each other. They have to dynamically figure out a common language so they can exchange information and fulfill the goals that the human programmer gave to them.”

By means of its ability to attempt to interpret user intent and reconcile with the existing schema, Shapeshifter becomes this dynamic negotiating partner. Its decision-making process also echoes the idea of a [self-driving database](https://www.cs.cmu.edu/~pavlo/blog/2018/04/what-is-a-self-driving-database-management-system.html) from Andy Pavlo, which he defines as:

> - The ability to automatically select actions to improve some objective function (e.g., throughput, latency, cost). This selection also includes how many resources to use to apply an action.
> - The ability to automatically choose when to apply an action.
> - The ability to automatically learn from its actions and refine its decision making process.

but expands the scope to include the ability to make decisions about how to transform data.

I'm not sure that including schema flexibility within the database, or using LLMs within the database in a way that can effect results is the right approach, but I think it might be an interesting direction to consider and explore.

## Technologies used

- [zod](https://zod.dev/) and [JSON Schema](https://json-schema.org/) for representing schemas
- [jq](https://stedolan.github.io/jq/) for transforming data
- [level](https://leveljs.org/) for data storage
- [mingo](https://github.com/kofrasa/mingo) for MongoDB-like querying
- [quicktype](https://quicktype.io/) for generating code from JSON schemas
- [Vercel's ai sdk](https://sdk.vercel.ai/) for calling LLMs
- [tRPC](https://trpc.io/) for the API, which can be run in a browser or as a standalone server
- [React](https://react.dev/) for the frontend
- [Vite](https://vitejs.dev/) for the frontend build

## How it works

### Adding or updating a document

- The user calls Shapeshifter with one or more documents to add or update, along with a set of allowed operations (`isSubtype`, `isSupertype`, `map`, `migrate`).
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

## Potential future work

- Ability to create indexes and views
- Use level's [iterators](https://github.com/Level/abstract-level?tab=readme-ov-file#iterator--dbiteratoroptions) for querying, as opposed to filtering after loading all documents into memory
- UI Console
  - Ability to delete documents
  - Ability to browse all documents in a collection without querying
- Include request history in the decision-making process (as opposed to request and current schema)
