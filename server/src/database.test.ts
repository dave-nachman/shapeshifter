import { expect, test } from '@jest/globals';
import { Database } from './database';
import { LevelStore } from './stores/level';
import { Document } from './types';
import { MemoryLevel } from 'memory-level';

import dotenv from 'dotenv';
import { getDecisionForNewDocuments, getDecisionForQuery } from './decision';
dotenv.config();

const decider = {
  getDecisionForNewDocuments,
  getDecisionForQuery,
};

async function createDatabase() {
  const database = new Database(
    // @ts-expect-error abc
    new LevelStore(new MemoryLevel<string, Document>({}) as unknown)
  );
  await database.createCollection('albums');
  await database.addDocuments(
    'albums',
    [
      {
        title: "Sgt. Pepper's Lonely Hearts Club Band",
        artist: 'The Beatles',
        year: 1967,
      },
      {
        title: 'The Dark Side of the Moon',
        artist: 'Pink Floyd',
        year: 1973,
      },
    ],
    ['map'],
    decider
  );
  return database;
}

test('check documents', async () => {
  const database = await createDatabase();
  const { documents } = await database.getCollection('albums');
  expect(documents.length).toBe(2);
  expect(documents[0].title).toBe("Sgt. Pepper's Lonely Hearts Club Band");
  expect(documents[1].title).toBe('The Dark Side of the Moon');
});

test('query title', async () => {
  const database = await createDatabase();
  const { documents, operation } = await database.queryDocuments(
    'albums',
    {},
    {
      title: '',
    },
    {},
    ['map'],
    decider
  );
  expect(documents.length).toBe(2);
  expect(operation).toBe(undefined);
});

test('query name', async () => {
  const database = await createDatabase();
  const { documents, operation } = await database.queryDocuments(
    'albums',
    {},
    {
      name: '',
    },
    {},
    ['map'],
    decider
  );
  expect(documents.length).toBe(2);
  expect(operation?.type).toBe('map');
}, 20000);

test('map input name', async () => {
  const database = await createDatabase();
  const { operation } = await database.addDocument(
    'albums',
    {
      name: 'The Beatles',
      artist: 'The Beatles',
      year: 1967,
    },
    ['map'],
    decider
  );
  expect(operation?.type).toBe('map');
}, 20000);

test('migrate', async () => {
  const database = await createDatabase();
  const { operation } = await database.addDocument(
    'albums',
    {
      name: 'The Beatles',
      artist: 'The Beatles',
      years: [1967],
    },
    ['migrate', 'map'],
    decider
  );
  expect(operation?.type).toBe('migrate');
}, 20000);

test('update document', async () => {
  const database = await createDatabase();
  const { documents } = await database.getCollection('albums');
  const { operation, document } = await database.updateDocument(
    'albums',
    documents[0]._id,
    { title: 'The Beatles' },
    ['map', 'isSubset'],
    decider
  );
  expect(operation).toBe(undefined);
  expect(document?.title).toBe('The Beatles');
});

test('replace document', async () => {
  const database = await createDatabase();
  const { documents } = await database.getCollection('albums');
  const { operation, document } = await database.replaceDocument(
    'albums',
    documents[0]._id,
    { title: 'The Beatles' },
    ['isSubset', 'map'],
    decider
  );
  expect(operation?.type).toBe('isSubset');
  expect(document?.title).toBe('The Beatles');
  expect(document?.year).toBe(undefined);
});
