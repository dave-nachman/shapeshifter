import { initTRPC } from '@trpc/server';
import { getDecisionForNewDocuments, getDecisionForQuery } from './decision';

export const createContext = async () => {
  const decider = {
    getDecisionForNewDocuments,
    getDecisionForQuery,
  };

  return {
    decider,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
const t = initTRPC.context<Context>().create({
  allowOutsideOfServer: true,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;
