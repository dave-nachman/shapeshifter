import cors from 'cors';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import buildRoutes from './routes/collections';
import { makeOpenApiSpec, routeToExpress } from './types/route';

import dotenv from 'dotenv';
import { LevelStore } from './stores/level';
import { Level } from 'level';
import { Document } from './types';
import { Database } from './database';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());

const errorHandler = (err: Error, req: Request, res: Response) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
};

const router = express.Router();

const database = new Database(
  new LevelStore(
    new Level<string, Document>('db', {
      valueEncoding: 'json',
      keyEncoding: 'utf8',
    })
  )
);

const routes = buildRoutes(database);

routes.forEach((route) => {
  const handler = routeToExpress(route);
  router[route.method](route.path, handler);
});

const apiSpecs = makeOpenApiSpec(routes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiSpecs));

app.get('/openapi.json', (req, res) => {
  res.json(apiSpecs);
});

app.use('/api/v1', router);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
