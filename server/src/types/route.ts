import { z } from 'zod';
import { Request, Response } from 'express';
import { createDocument } from 'zod-openapi';
import { groupBy } from 'lodash';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteConfig<
  Input extends z.ZodType,
  Output extends z.ZodType,
  Params extends z.ZodType = z.AnyZodObject,
  Query extends z.ZodType = z.AnyZodObject,
> {
  id?: string;
  description?: string;
  method: HttpMethod;
  path: string;
  input: Input;
  output: Output;
  params?: Params;
  query?: Query;
  handler: (
    data: z.infer<Input>,
    params: z.infer<Params>,
    query: z.infer<Query>
  ) => Promise<z.infer<Output>> | z.infer<Output>;
  summary: string;
  tags: string[];
}

export function createRoute(
  config: RouteConfig<
    z.ZodTypeAny,
    z.ZodTypeAny,
    z.AnyZodObject,
    z.AnyZodObject
  >
) {
  return config;
}

export function routeToExpress<
  I extends z.ZodType,
  O extends z.ZodType,
  P extends z.ZodType,
  Q extends z.ZodType,
>(route: RouteConfig<I, O, P, Q>) {
  return async (req: Request, res: Response) => {
    try {
      // Validate inputs
      const input = route.method === 'get' ? {} : route.input.parse(req.body);
      const params = route.params?.parse(req.params) ?? {};
      const query = route.query?.parse(req.query) ?? {};

      // Execute handler
      const result = await route.handler(input, params, query);

      // Validate output
      const validatedResult = route.output.parse(result);

      // Send response
      const statusCode = route.method === 'post' ? 201 : 200;
      res.status(statusCode).json(validatedResult);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: (error as Error).message });
      }
    }
  };
}

export function makeOpenApiSpec(
  routes: RouteConfig<
    z.ZodTypeAny,
    z.ZodTypeAny,
    z.AnyZodObject,
    z.AnyZodObject
  >[]
) {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Shapeshifter',
      version: '1.0.0',
    },
    paths: Object.fromEntries(
      Object.entries(groupBy(routes, 'path')).map(([path, routes]) => [
        path
          .split('/')
          .map((part) => (part.startsWith(':') ? `{${part.slice(1)}}` : part))
          .join('/'),
        Object.fromEntries(
          routes.map((route) => [
            route.method,
            {
              operationId: route.id,
              description: route.description,
              requestParams: { path: route.params },
              requestBody: {
                content: {
                  'application/json': { schema: route.input },
                },
              },
              responses: {
                '200': {
                  description: '200 OK',
                  content: {
                    'application/json': { schema: route.output },
                  },
                },
              },
            },
          ])
        ),
      ])
    ),
  });
}
