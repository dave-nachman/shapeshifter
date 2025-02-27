import {
  Badge,
  Button,
  createListCollection,
  Flex,
  Heading,
  Spinner,
  Tabs,
} from "@chakra-ui/react";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import * as changeCase from "change-case";
import { useEffect, useState } from "react";
import { Checkbox } from "./components/ui/checkbox";
import { Provider } from "./components/ui/provider";
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "./components/ui/select";
import {
  databaseRouter,
  DatabaseRouter,
} from "../../server/src/databaseRouter";
import * as types from "../../server/src/types";
import { DecisionRouter } from "../../server/src/decisionRouter";

import { createTRPCClient, httpBatchLink, TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";

// @ts-expect-error ignored type error
const decisionTrpc = createTRPCClient<DecisionRouter>({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
    }),
  ],
});

export const customLink: TRPCLink<DatabaseRouter> = () => {
  return ({ op }) => {
    return observable((observer) => {
      const caller = databaseRouter.createCaller({
        decider: {
          getDecisionForNewDocuments: (existingSchema, newDocuments) =>
            decisionTrpc.getDecisionForNewDocuments.query({
              // @ts-expect-error ignored type error
              existingSchema: existingSchema as unknown,
              // @ts-expect-error ignored type error
              newDocuments: newDocuments as unknown,
            }),
          getDecisionForQuery: (inputSchema, targetSchema) => {
            return decisionTrpc.getDecisionForQuery.query({
              // @ts-expect-error ignored type error
              inputSchema: inputSchema as unknown,
              // @ts-expect-error ignored type error
              targetSchema: targetSchema as unknown,
            });
          },
        },
      });
      // @ts-expect-error can't infer type
      caller[op.path](op.input)
        .catch((error: unknown) => {
          console.error(error);
          // @ts-expect-error ignored type error
          observer.error(error);
        })

        .then((result: unknown) => {
          observer.next({ result: { type: "data", data: result } });
          observer.complete();
        });
      return () => {};
    });
  };
};
// Create a mock client that directly invokes procedures instead of making HTTP requests
// @ts-expect-error ignored type error
const trpc = createTRPCClient<DatabaseRouter>({
  links: [customLink],
});

function useCollections() {
  const [collections, setCollections] = useState<types.Collection[]>();

  function refresh() {
    trpc.getCollections.query().then((response) => {
      setCollections(response ?? []);
    });
  }

  useEffect(() => {
    refresh();
  }, []);

  return { collections, refresh };
}

function useNewCollection({
  collection,
  setCollection,
  refresh,
}: {
  collection: string | null;
  setCollection: (collection: string | null) => void;
  refresh: () => void;
}) {
  useEffect(() => {
    if (collection === "create-new-collection") {
      const name = prompt("Enter a name for the new collection");
      if (name) {
        trpc.createCollection.mutate({ name }).then(() => {
          setCollection(name);
          refresh();
        });
      } else {
        setCollection(null);
      }
    }
  }, [collection, refresh, setCollection]);
}

function CollectionPicker({
  collections,
  collection,
  setCollection,
}: {
  collections: types.Collection[] | undefined;
  collection: string | null;
  setCollection: (collection: string) => void;
}) {
  if (!collections) {
    return null;
  }

  return (
    <SelectRoot
      collection={createListCollection({
        items: collections
          .map((collection) => ({
            label: changeCase.capitalCase(collection.name),
            value: collection.name,
          }))
          .concat({
            label: "Create new collection",
            value: "create-new-collection",
          }),
      })}
      size="sm"
      width="320px"
      value={collection ? [collection] : undefined}
      onValueChange={(value) => {
        setCollection(value.value[0]);
      }}
    >
      <SelectLabel>Collection</SelectLabel>
      <SelectTrigger>
        <SelectValueText placeholder="Select collection" />
      </SelectTrigger>
      <SelectContent>
        {collections.map((collection) => (
          <SelectItem
            item={{
              label: changeCase.capitalCase(collection.name),
              value: collection.name,
            }}
            key={collection.name}
          >
            {changeCase.capitalCase(collection.name)}
          </SelectItem>
        ))}
        <SelectItem
          item={{
            label: "Create new collection",
            value: "create-new-collection",
          }}
        >
          Create new collection
        </SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}

function OperationView({
  operation,
}: {
  operation: types.AddDocumentResponse["operation"];
}) {
  if (!operation) {
    return null;
  }
  switch (operation.type) {
    case "isSubset":
      return <Badge colorPalette="green">Subtype of existing schema</Badge>;
    case "map":
      return (
        <div className="flex flex-row gap-2 items-center">
          <Badge colorPalette="green">Transform</Badge>
          <div
            className="font-mono flex text-green-700 rounded-md px-4 py-1"
            style={{ fontFamily: "monospace", fontSize: 12 }}
          >
            {operation.jqMappingCommandPerDocument}
          </div>
        </div>
      );
    case "migrate":
      return (
        <div className="flex flex-row gap-2 items-center">
          <Badge colorPalette="green">Migrate existing</Badge>
          <div
            className="font-mono flex text-green-700 rounded-md px-4 py-1"
            style={{ fontFamily: "monospace", fontSize: 12 }}
          >
            {operation.jqMappingCommandPerDocumentFromOldToNewSchema}
          </div>
        </div>
      );
    case "isSuperset":
      return <Badge colorPalette="green">Supertype of existing schema</Badge>;
    case "reject":
      return (
        <div className="text-red-700">
          <Badge colorPalette="red">Rejected</Badge> {operation.message}
        </div>
      );
  }
}

const languageOptions = {
  typescript: "TypeScript",
  schema: "JSON Schema",
  python: "Python",
};

const allowedOperationsOptions = {
  isSubset: "Subtype",
  isSuperset: "Supertype",
  map: "Transform",
  migrate: "Migrate existing",
};

function AddView({ collection }: { collection: string }) {
  const [input, setInput] = useState<string>("");
  const [response, setResponse] = useState<
    types.AddDocumentResponse | "loading"
  >();
  const [error, setError] = useState<string | null>(null);
  const [schemaLanguage, setSchemaLanguage] =
    useState<keyof typeof languageOptions>("typescript");
  const [schema, setSchema] = useState<string | object | "loading">();

  const [allowedOperations, setAllowedOperations] = useState<
    (keyof typeof allowedOperationsOptions)[]
  >(
    Object.keys(
      allowedOperationsOptions
    ) as (keyof typeof allowedOperationsOptions)[]
  );

  useEffect(() => {
    if (collection && collection !== "create-new-collection") {
      trpc.getCollectionSchema
        .query({
          name: collection,
          language: schemaLanguage,
        })
        .then((response) => {
          setSchema(response);
        });
    }
  }, [collection, schemaLanguage]);

  return (
    <Flex direction="row" gap={16}>
      <Flex className="h-full w-full" direction="column" gap={4} flex={1}>
        <Flex border="1px solid #e0e0e0" borderRadius="md">
          <CodeMirror
            value={input}
            placeholder="Enter a JSON document to add to the collection. If _id is included and matches an existing document, it will be replaced."
            height="400px"
            width="700px"
            extensions={[
              json(),
              EditorView.theme({
                ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                ".cm-gutters": { display: "none" }, // Hides line numbers
                ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
              }),
              EditorView.lineWrapping,
            ]}
            onChange={(value) => setInput(value)}
          />
        </Flex>
        <Flex direction="column" gap={1}>
          <Heading size="sm">Allowed Operations</Heading>
          <Flex direction="row" gap={2}>
            {Object.entries(allowedOperationsOptions).map(
              ([operation, label]) => (
                <Flex key={operation}>
                  <Checkbox
                    variant="outline"
                    size="xs"
                    checked={allowedOperations.includes(
                      operation as keyof typeof allowedOperationsOptions
                    )}
                    onCheckedChange={({ checked }) => {
                      const operations = checked
                        ? [...allowedOperations, operation]
                        : allowedOperations.filter((o) => o !== operation);
                      setAllowedOperations(
                        operations as (keyof typeof allowedOperationsOptions)[]
                      );
                    }}
                  >
                    {label}
                  </Checkbox>
                </Flex>
              )
            )}
          </Flex>
        </Flex>
        <Flex justify="flex-end">
          <Button
            onClick={async () => {
              setResponse("loading");
              setSchema("loading");
              setError(null);
              try {
                const document = JSON.parse(input);
                let response: types.AddDocumentResponse;
                if (document._id) {
                  response = await trpc.replaceDocument.mutate({
                    name: collection,
                    documentId: document._id,
                    document,
                    allowedOperations: allowedOperations as (
                      | "map"
                      | "isSubset"
                      | "isSuperset"
                      | "migrate"
                    )[],
                  });
                } else {
                  response = await trpc.addDocument.mutate({
                    name: collection,
                    document,
                    allowedOperations: allowedOperations as (
                      | "map"
                      | "isSubset"
                      | "isSuperset"
                      | "migrate"
                    )[],
                  });
                }
                setResponse(response);

                const schema = await trpc.getCollectionSchema.query({
                  name: collection,
                  language: schemaLanguage,
                });

                setSchema(schema);
              } catch (error) {
                console.error(error);
                setError(String(error));
              }
            }}
          >
            Upsert
          </Button>
        </Flex>
      </Flex>
      <Flex className="h-full w-full" flex={1}>
        <Flex direction="column" gap={4}>
          {error && <div className="text-red-700">{error}</div>}
          <>
            {response === "loading" ? (
              <Spinner />
            ) : response ? (
              <Flex direction="column" gap={4}>
                <Heading size="md">Response</Heading>
                <div className="text-green-700">
                  <OperationView operation={response.operation} />
                </div>
                <CodeMirror
                  value={JSON.stringify(response?.document, null, 2)}
                  height="180px"
                  width="700px"
                  extensions={[
                    json(),
                    EditorView.theme({
                      ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                      ".cm-gutters": { display: "none" }, // Hides line numbers
                      ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                    }),
                  ]}
                />
              </Flex>
            ) : null}
          </>
          {response !== "loading" && response && (
            <>
              <Heading size="md">Collection Schema</Heading>
              {schema === "loading" ? (
                <Spinner />
              ) : schema ? (
                <Tabs.Root
                  defaultValue={schemaLanguage}
                  onValueChange={(value) =>
                    setSchemaLanguage(
                      value.value as keyof typeof languageOptions
                    )
                  }
                >
                  <Tabs.List>
                    {Object.entries(languageOptions).map(([key, label]) => (
                      <Tabs.Trigger key={key} value={key}>
                        {label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <Tabs.Content value={schemaLanguage}>
                    <CodeMirror
                      value={
                        typeof schema === "string"
                          ? schema
                          : JSON.stringify(schema)
                      }
                      height="220px"
                      width="700px"
                      extensions={[
                        javascript(),
                        EditorView.lineWrapping,
                        EditorView.theme({
                          ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                          ".cm-gutters": { display: "none" }, // Hides line numbers,
                          ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                        }),
                      ]}
                    />
                  </Tabs.Content>
                </Tabs.Root>
              ) : null}
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}

function QueryView({ collection }: { collection: string }) {
  const [shape, setShape] = useState<string>("");
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [allowedOperations, setAllowedOperations] = useState<
    (keyof typeof allowedOperationsOptions)[]
  >(
    Object.keys(
      allowedOperationsOptions
    ) as (keyof typeof allowedOperationsOptions)[]
  );
  const [response, setResponse] = useState<
    types.QueryDocumentsResponse | "loading"
  >();
  const [schemaLanguage, setSchemaLanguage] =
    useState<keyof typeof languageOptions>("typescript");
  const [schema, setSchema] = useState<string | object | "loading">();

  useEffect(() => {
    trpc.getCollectionSchema
      .query({
        name: collection,
        language: schemaLanguage,
      })
      .then((response) => {
        setSchema(response);
      });
  }, [collection, schemaLanguage]);

  return (
    <Flex direction="row" gap={16}>
      <Flex className="h-full w-full" direction="column" gap={4} flex={1}>
        <Flex direction="column" gap={2}>
          <Heading size="sm">Shape</Heading>
          <Flex border="1px solid #e0e0e0" borderRadius="md">
            <CodeMirror
              value={shape}
              height="200px"
              width="700px"
              placeholder="Enter a JSON object representing the shape of the response"
              extensions={[
                json(),
                EditorView.theme({
                  ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                  ".cm-gutters": { display: "none" }, // Hides line numbers
                  ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                }),
              ]}
              onChange={(value) => setShape(value)}
            />
          </Flex>
        </Flex>
        <Flex direction="column" gap={2}>
          <Heading size="sm">Filter</Heading>
          <Flex border="1px solid #e0e0e0" borderRadius="md">
            <CodeMirror
              value={filter}
              height="100px"
              width="700px"
              placeholder="Enter a filter using Mongo syntax"
              extensions={[
                json(),
                EditorView.theme({
                  ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                  ".cm-gutters": { display: "none" }, // Hides line numbers
                  ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                }),
              ]}
              onChange={(value) => setFilter(value)}
            />
          </Flex>
        </Flex>
        <Flex direction="column" gap={2}>
          <Heading size="sm">Allowed Operations</Heading>
          <Flex direction="row" gap={2}>
            {Object.entries(allowedOperationsOptions)
              .filter(([operation]) => operation !== "migrate")
              .map(([operation, label]) => (
                <Flex key={operation}>
                  <Checkbox
                    variant="outline"
                    size="xs"
                    checked={allowedOperations.includes(
                      operation as keyof typeof allowedOperationsOptions
                    )}
                    onCheckedChange={({ checked }) => {
                      const operations = checked
                        ? [...allowedOperations, operation]
                        : allowedOperations.filter((o) => o !== operation);
                      setAllowedOperations(
                        operations as (keyof typeof allowedOperationsOptions)[]
                      );
                    }}
                  >
                    {label}
                  </Checkbox>
                </Flex>
              ))}
          </Flex>
        </Flex>
        <Flex justify="flex-end">
          <Button
            onClick={async () => {
              setResponse("loading");
              setSchema("loading");
              setError(null);
              try {
                const response = await trpc.queryDocuments.query({
                  name: collection,
                  shape: JSON.parse(shape),
                  filter: filter.length > 0 ? JSON.parse(filter) : undefined,
                  allowedOperations: allowedOperations as (
                    | "map"
                    | "isSubset"
                    | "isSuperset"
                  )[],
                });

                setResponse(response);

                const schema = await trpc.getCollectionSchema.query({
                  name: collection,
                  language: schemaLanguage,
                });
                setSchema(schema);
              } catch (error) {
                setError(String(error).split(": ")[1]);
              }
            }}
          >
            Query
          </Button>
        </Flex>
      </Flex>
      <Flex className="h-full w-full" flex={1}>
        <Flex direction="column" gap={4}>
          <>
            {error && <div className="text-red-700">{error}</div>}
            {response === "loading" ? (
              <Spinner />
            ) : response ? (
              <Flex direction="column" gap={4}>
                <Heading size="md">Response</Heading>
                <div className="text-green-700">
                  <OperationView operation={response.operation} />
                </div>
                <CodeMirror
                  value={JSON.stringify(response?.documents, null, 2)}
                  height="180px"
                  width="700px"
                  extensions={[
                    json(),
                    EditorView.theme({
                      ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                      ".cm-gutters": { display: "none" }, // Hides line numbers
                      ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                    }),
                  ]}
                />
              </Flex>
            ) : null}
          </>
          {response !== "loading" && (
            <>
              <Heading size="md">Collection Schema</Heading>
              {schema === "loading" ? (
                <Spinner />
              ) : schema ? (
                <Tabs.Root
                  defaultValue={schemaLanguage}
                  onValueChange={(value) =>
                    setSchemaLanguage(
                      value.value as keyof typeof languageOptions
                    )
                  }
                >
                  <Tabs.List>
                    {Object.entries(languageOptions).map(([key, label]) => (
                      <Tabs.Trigger key={key} value={key}>
                        {label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                  <Tabs.Content value={schemaLanguage}>
                    <CodeMirror
                      value={
                        typeof schema === "string"
                          ? schema
                          : JSON.stringify(schema)
                      }
                      height="220px"
                      width="700px"
                      extensions={[
                        javascript(),
                        EditorView.lineWrapping,
                        EditorView.theme({
                          ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                          ".cm-gutters": { display: "none" }, // Hides line numbers
                          ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
                        }),
                      ]}
                    />
                  </Tabs.Content>
                </Tabs.Root>
              ) : null}
            </>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
export default function App() {
  const { collections, refresh } = useCollections();
  useEffect(() => {
    if (collections) {
      setCollection(collections?.[0]?.name ?? null);
    }
  }, [collections]);

  const [collection, setCollection] = useState<string | null>(null);
  useNewCollection({ collection, setCollection, refresh });

  return (
    <Provider>
      <Flex direction="column" gap={4} px={12} py={8}>
        <Heading className="flex flex-row gap-2 items-center">
          Shapeshifter{" "}
          <span className="inline-block text-gray-500" style={{ fontSize: 14 }}>
            Console
          </span>
          <a href="https://github.com/dave-nachman/shapeshifter">
            <img
              src="/github-mark.png"
              alt="Shapeshifter"
              className="w-6 h-6 opacity-50"
            />
          </a>
        </Heading>
        <Flex direction="column" gap={4}>
          <CollectionPicker
            collections={collections}
            collection={collection}
            setCollection={setCollection}
          />

          {collection && (
            <Tabs.Root defaultValue="add">
              <Tabs.List>
                <Tabs.Trigger value="add">Upsert</Tabs.Trigger>
                <Tabs.Trigger value="query">Query</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="add">
                {collection && <AddView collection={collection} />}
              </Tabs.Content>
              <Tabs.Content value="query">
                {collection && <QueryView collection={collection} />}
              </Tabs.Content>
            </Tabs.Root>
          )}
        </Flex>
      </Flex>
    </Provider>
  );
}
