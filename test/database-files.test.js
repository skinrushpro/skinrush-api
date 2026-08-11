import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';

import {
  summarizeValidationReport,
  validateDatabaseFiles
} from '../scripts/validate-database-files.js';

const temporaryDirectories = new Set();

afterEach(async () => {
  await Promise.all([...temporaryDirectories].map(directory => rm(directory, {
    recursive: true,
    force: true
  })));
  temporaryDirectories.clear();
});

async function createExports(overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'skinrush-data-'));
  temporaryDirectories.add(directory);

  const files = {
    'skins.csv': [
      'skin_id,skin_name,weapon_name,rarity_name,min_float,max_float,category_name,rarity_color,pattern_id,pattern_name,paint_index,stattrak,souvenir,team_restriction,image_url,legacy_model,phase,special_notes,description,item_type',
      'skin-1,"FAMAS | Test",FAMAS,Restricted,0,1,Rifle,NULL,NULL,NULL,1,True,False,Both,NULL,False,NULL,NULL,"Quoted, description",weapon'
    ].join('\n'),
    'collections.csv': [
      'collection_id,collection_name,release_date,source_type,operation_name,is_active',
      'collection-1,Test Collection,NULL,NULL,NULL,True'
    ].join('\n'),
    'skin_collections.csv': [
      'skin_id,collection_id',
      'skin-1,collection-1'
    ].join('\n'),
    'cases.csv': [
      'case_id,case_name,release_date,operation_name,source_type,collection_name,drop_pool,discontinued,rare_case,case_type,community_case',
      'case-1,Test Case,NULL,NULL,NULL,NULL,Active,False,False,Weapon,False'
    ].join('\n'),
    'skin_cases.csv': [
      'skin_id,case_id',
      'skin-1,case-1'
    ].join('\n'),
    ...overrides
  };

  await Promise.all(Object.entries(files).map(([name, content]) => (
    writeFile(path.join(directory, name), content, 'utf8')
  )));

  return directory;
}

test('valid exports report counts and normalise literal NULL values', async () => {
  const directory = await createExports();

  const report = await validateDatabaseFiles(directory);

  assert.equal(report.valid, true);
  assert.deepEqual(report.counts, {
    skins: 1,
    collections: 1,
    skinCollections: 1,
    cases: 1,
    skinCases: 1
  });
  assert.equal(report.normalizedNulls, 13);
  assert.deepEqual(report.errors, []);
});

test('duplicate primary IDs and links are rejected', async () => {
  const directory = await createExports({
    'collections.csv': [
      'collection_id,collection_name,release_date,source_type,operation_name,is_active',
      'collection-1,First,NULL,NULL,NULL,True',
      'collection-1,Duplicate,NULL,NULL,NULL,True'
    ].join('\n'),
    'skin_collections.csv': [
      'skin_id,collection_id',
      'skin-1,collection-1',
      'skin-1,collection-1'
    ].join('\n')
  });

  const report = await validateDatabaseFiles(directory);

  assert.equal(report.valid, false);
  assert.deepEqual(
    report.errors.map(error => error.code).sort(),
    ['DUPLICATE_ID', 'DUPLICATE_LINK']
  );
});

test('links to unknown skins, collections, and cases are rejected', async () => {
  const directory = await createExports({
    'skin_collections.csv': [
      'skin_id,collection_id',
      'skin-missing,collection-missing'
    ].join('\n'),
    'skin_cases.csv': [
      'skin_id,case_id',
      'skin-missing,case-missing'
    ].join('\n')
  });

  const report = await validateDatabaseFiles(directory);

  assert.equal(report.valid, false);
  assert.deepEqual(
    report.errors.map(error => error.code).sort(),
    [
      'ORPHAN_CASE',
      'ORPHAN_COLLECTION',
      'ORPHAN_SKIN',
      'ORPHAN_SKIN'
    ]
  );
});

test('validation summaries group repeated errors and keep bounded samples', () => {
  const summary = summarizeValidationReport({
    valid: false,
    counts: { skins: 1 },
    normalizedNulls: 2,
    errors: [
      { code: 'ORPHAN_SKIN', message: 'Unknown skin_id: skin-1' },
      { code: 'ORPHAN_SKIN', message: 'Unknown skin_id: skin-2' },
      { code: 'ORPHAN_CASE', message: 'Unknown case_id: case-1' }
    ]
  }, 1);

  assert.deepEqual(summary, {
    valid: false,
    counts: { skins: 1 },
    normalizedNulls: 2,
    errorCount: 3,
    errorsByCode: {
      ORPHAN_SKIN: { count: 2, samples: ['Unknown skin_id: skin-1'] },
      ORPHAN_CASE: { count: 1, samples: ['Unknown case_id: case-1'] }
    }
  });
});
