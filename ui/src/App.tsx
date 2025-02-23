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
import {
  client,
  createCollection,
  createDocument,
  getCollections,
  getCollectionSchema,
  queryDocumentsByShape,
} from "./client/services.gen";
import {
  CreateDocumentResponse,
  GetCollectionSchemaResponse,
  GetCollectionsResponse,
  QueryDocumentsByShapeResponse,
} from "./client/types.gen";
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

client.setConfig({
  baseUrl: "http://localhost:3000/api/v1",
});

function useCollections() {
  const [collections, setCollections] = useState<GetCollectionsResponse>();

  function refresh() {
    getCollections().then((response) => {
      setCollections(response.data);
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
  setCollection: (collection: string) => void;
  refresh: () => void;
}) {
  useEffect(() => {
    if (collection === "create-new-collection") {
      const name = prompt("Enter a name for the new collection");
      if (name) {
        createCollection({ body: { name } }).then(() => {
          setCollection(name);
          refresh();
        });
      }
    }
  }, [collection, refresh, setCollection]);
}

function CollectionPicker({
  collections,
  collection,
  setCollection,
}: {
  collections: GetCollectionsResponse | undefined;
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
  operation: CreateDocumentResponse["operation"];
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
    CreateDocumentResponse | "loading"
  >();
  const [error, setError] = useState<string | null>(null);
  const [schemaLanguage, setSchemaLanguage] =
    useState<keyof typeof languageOptions>("typescript");
  const [schema, setSchema] = useState<
    GetCollectionSchemaResponse | "loading"
  >();

  const [allowedOperations, setAllowedOperations] = useState<
    (keyof typeof allowedOperationsOptions)[]
  >(
    Object.keys(
      allowedOperationsOptions,
    ) as (keyof typeof allowedOperationsOptions)[],
  );

  useEffect(() => {
    getCollectionSchema({
      path: {
        collection,
      },
      query: {
        language: schemaLanguage,
      },
    }).then((response) => {
      setSchema(response.data);
    });
  }, [collection, schemaLanguage]);

  return (
    <Flex direction="row" gap={16}>
      <Flex className="h-full w-full" direction="column" gap={4} flex={1}>
        <Flex border="1px solid #e0e0e0" borderRadius="md">
          <CodeMirror
            value={input}
            height="400px"
            width="700px"
            extensions={[
              json(),
              EditorView.theme({
                ".cm-activeLine": { backgroundColor: "transparent" }, // Removes highlighted line
                ".cm-gutters": { display: "none" }, // Hides line numbers
                ".ͼ1.cm-focused": { outline: "none" }, // Removes focus outline
              }),
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
                    checked={allowedOperations.includes(operation)}
                    onCheckedChange={({ checked }) => {
                      setAllowedOperations(
                        checked
                          ? [...allowedOperations, operation]
                          : allowedOperations.filter((o) => o !== operation),
                      );
                    }}
                  >
                    {label}
                  </Checkbox>
                </Flex>
              ),
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
                const response = await createDocument({
                  path: {
                    collection,
                  },
                  body: JSON.parse(input),
                  query: {
                    allowed: allowedOperations.join(","),
                  },
                });
                if (response.error) {
                  setError(response.error.error);
                  setResponse(undefined);
                } else {
                  setResponse(response.data);
                }
                const schema = await getCollectionSchema({
                  path: {
                    collection,
                  },
                  query: {
                    language: schemaLanguage,
                  },
                });
                setSchema(schema.data);
              } catch (error) {
                console.error(error);
                setError(String(error));
              }
            }}
          >
            Add
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
                      value.value as keyof typeof languageOptions,
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
      allowedOperationsOptions,
    ) as (keyof typeof allowedOperationsOptions)[],
  );
  const [response, setResponse] = useState<
    QueryDocumentsByShapeResponse | "loading"
  >();
  const [schemaLanguage, setSchemaLanguage] =
    useState<keyof typeof languageOptions>("typescript");
  const [schema, setSchema] = useState<
    GetCollectionSchemaResponse | "loading"
  >();

  useEffect(() => {
    getCollectionSchema({
      path: {
        collection,
      },
      query: {
        language: schemaLanguage,
      },
    }).then((response) => {
      setSchema(response.data);
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
                    checked={allowedOperations.includes(operation)}
                    onCheckedChange={({ checked }) => {
                      setAllowedOperations(
                        checked
                          ? [...allowedOperations, operation]
                          : allowedOperations.filter((o) => o !== operation),
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
                const response = await queryDocumentsByShape({
                  path: {
                    collection,
                  },
                  body: {
                    shape: JSON.parse(shape),
                    filter: filter.length > 0 ? JSON.parse(filter) : undefined,
                  },
                  query: {
                    allowed:
                      allowedOperations.length > 0
                        ? allowedOperations.join(",")
                        : undefined,
                  },
                });
                if (response.error) {
                  setError(response.error.error);
                  setResponse(undefined);
                } else {
                  setResponse(response.data);
                }
                const schema = await getCollectionSchema({
                  path: {
                    collection,
                  },
                  query: {
                    language: schemaLanguage,
                  },
                });
                setSchema(schema.data);
              } catch (error) {
                console.error(error);
                setError(String(error));
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
                      value.value as keyof typeof languageOptions,
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
        <Heading>
          Shapeshifter{" "}
          <span
            className="inline-block text-gray-500 text"
            style={{ fontSize: 14 }}
          >
            Console
          </span>
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
                <Tabs.Trigger value="add">Add</Tabs.Trigger>
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
