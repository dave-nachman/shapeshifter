import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Document Database API',
      version: '1.0.0',
      description: 'A simple document database REST API',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      schemas: {
        Collection: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the collection',
            },
            documents: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Document',
              },
            },
          },
        },
        Document: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'Unique identifier for the document',
            },
          },
          additionalProperties: true,
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
      },
    },
  },
  apis: ['./src/index.ts'], // Path to the API routes
};

export const specs = swaggerJsdoc(options);
