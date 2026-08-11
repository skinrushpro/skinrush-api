import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'csv-parse/sync';

const definitions = {
  skins: {
    file: 'skins.csv',
    id: 'skin_id',
    columns: [
      'skin_id', 'skin_name', 'weapon_name', 'rarity_name', 'min_float',
      'max_float', 'category_name', 'rarity_color', 'pattern_id', 'pattern_name',
      'paint_index', 'stattrak', 'souvenir', 'team_restriction', 'image_url',
      'legacy_model', 'phase', 'special_notes', 'description', 'item_type'
    ]
  },
  collections: {
    file: 'collections.csv',
    id: 'collection_id',
    columns: [
      'collection_id', 'collection_name', 'release_date', 'source_type',
      'operation_name', 'is_active'
    ]
  },
  skinCollections: {
    file: 'skin_collections.csv',
    columns: ['skin_id', 'collection_id']
  },
  cases: {
    file: 'cases.csv',
    id: 'case_id',
    columns: [
      'case_id', 'case_name', 'release_date', 'operation_name', 'source_type',
      'collection_name', 'drop_pool', 'discontinued', 'rare_case', 'case_type',
      'community_case'
    ]
  },
  skinCases: {
    file: 'skin_cases.csv',
    columns: ['skin_id', 'case_id']
  }
};

function normalize(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === 'NULL'
    ? null
    : value;
}

async function loadExport(directory, definition, errors) {
  const content = await readFile(path.join(directory, definition.file), 'utf8');
  const records = parse(content, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false
  });
  const headers = records.shift() || [];

  for (const column of definition.columns) {
    if (!headers.includes(column)) {
      errors.push({
        code: 'MISSING_COLUMN',
        file: definition.file,
        message: `Missing required column: ${column}`
      });
    }
  }

  let normalizedNulls = 0;
  const rows = records.map((record, index) => {
    const row = {};
    headers.forEach((header, columnIndex) => {
      const value = normalize(record[columnIndex]);
      if (value === null && record[columnIndex] !== null) {
        normalizedNulls += 1;
      }
      row[header] = value;
    });
    row.__row = index + 2;
    return row;
  });

  return { rows, normalizedNulls };
}

function collectIds(rows, definition, errors) {
  const ids = new Set();

  rows.forEach(row => {
    const id = row[definition.id];
    if (!id) {
      errors.push({
        code: 'MISSING_ID',
        file: definition.file,
        row: row.__row,
        message: `${definition.id} is required`
      });
    } else if (ids.has(id)) {
      errors.push({
        code: 'DUPLICATE_ID',
        file: definition.file,
        row: row.__row,
        message: `Duplicate ${definition.id}: ${id}`
      });
    } else {
      ids.add(id);
    }
  });

  return ids;
}

function validateLinks({ rows, definition, left, right, errors }) {
  const links = new Set();

  rows.forEach(row => {
    const key = `${row[left.field]}\u0000${row[right.field]}`;
    if (links.has(key)) {
      errors.push({
        code: 'DUPLICATE_LINK',
        file: definition.file,
        row: row.__row,
        message: `Duplicate link: ${row[left.field]} -> ${row[right.field]}`
      });
    } else {
      links.add(key);
    }

    if (!left.ids.has(row[left.field])) {
      errors.push({
        code: left.code,
        file: definition.file,
        row: row.__row,
        message: `Unknown ${left.field}: ${row[left.field]}`
      });
    }

    if (!right.ids.has(row[right.field])) {
      errors.push({
        code: right.code,
        file: definition.file,
        row: row.__row,
        message: `Unknown ${right.field}: ${row[right.field]}`
      });
    }
  });
}

export async function validateDatabaseFiles(directory) {
  const errors = [];
  const entries = await Promise.all(
    Object.entries(definitions).map(async ([key, definition]) => [
      key,
      await loadExport(directory, definition, errors)
    ])
  );
  const exports = Object.fromEntries(entries);

  const skinIds = collectIds(exports.skins.rows, definitions.skins, errors);
  const collectionIds = collectIds(
    exports.collections.rows,
    definitions.collections,
    errors
  );
  const caseIds = collectIds(exports.cases.rows, definitions.cases, errors);

  validateLinks({
    rows: exports.skinCollections.rows,
    definition: definitions.skinCollections,
    left: { field: 'skin_id', ids: skinIds, code: 'ORPHAN_SKIN' },
    right: {
      field: 'collection_id',
      ids: collectionIds,
      code: 'ORPHAN_COLLECTION'
    },
    errors
  });

  validateLinks({
    rows: exports.skinCases.rows,
    definition: definitions.skinCases,
    left: { field: 'skin_id', ids: skinIds, code: 'ORPHAN_SKIN' },
    right: { field: 'case_id', ids: caseIds, code: 'ORPHAN_CASE' },
    errors
  });

  return {
    valid: errors.length === 0,
    counts: Object.fromEntries(
      Object.entries(exports).map(([key, value]) => [key, value.rows.length])
    ),
    normalizedNulls: Object.values(exports)
      .reduce((total, value) => total + value.normalizedNulls, 0),
    errors
  };
}

export function summarizeValidationReport(report, sampleLimit = 10) {
  const errorsByCode = {};

  for (const error of report.errors) {
    if (!errorsByCode[error.code]) {
      errorsByCode[error.code] = { count: 0, samples: [] };
    }

    const group = errorsByCode[error.code];
    group.count += 1;
    if (group.samples.length < sampleLimit) {
      group.samples.push(error.message);
    }
  }

  return {
    valid: report.valid,
    counts: report.counts,
    normalizedNulls: report.normalizedNulls,
    errorCount: report.errors.length,
    errorsByCode
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Usage: npm run validate:data -- <database-export-directory>');
    process.exitCode = 1;
  } else {
    try {
      const report = await validateDatabaseFiles(path.resolve(directory));
      console.log(JSON.stringify(summarizeValidationReport(report), null, 2));
      process.exitCode = report.valid ? 0 : 1;
    } catch (error) {
      console.error(`Validation failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
