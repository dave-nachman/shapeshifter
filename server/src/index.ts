import { createHTTPServer } from '@trpc/server/adapters/standalone';
import dotenv from 'dotenv';

import { decisionRouter } from './decisionRouter';
import { mergeRouters } from './trpc';
import { getDecisionForNewDocuments, getDecisionForQuery } from './decision';

dotenv.config();

const routers = [];

if (process.env.USE_DECISION_ROUTER === 'true') {
  routers.push(decisionRouter);
}

const server = createHTTPServer({
  router: mergeRouters(...routers),
  createContext() {
    return {
      decider: {
        getDecisionForNewDocuments,
        getDecisionForQuery,
      },
    };
  },
  middleware: (req, res, next) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Request-Method', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', '*');

    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    next();
  },
});

server.listen(process.env.PORT || 3000);
