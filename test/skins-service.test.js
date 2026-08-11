import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSkinQuery } from '../skins/query.js';
import { createSkinService } from '../skins/service.js';

function queryRecorder(respond) {
  const calls = [];
  return {
    calls,
    sequelize: {
      async query(sql, options) {
        calls.push({ sql, options });
        return respond(sql, options);
      }
    }
  };
}

test('legacy list preserves the existing Skin.findAll result', async () => {
  const expected = [{ id: 'skin-legacy' }];
  let calls = 0;
  const Skin = {
    async findAll() {
      calls += 1;
      return expected;
    }
  };
  const service = createSkinService({ sequelize: {}, Skin });

  assert.equal(await service.legacyList(), expected);
  assert.equal(calls, 1);
});

test('combined filters use fixed SQL fragments and replacements', async () => {
  const recorder = queryRecorder(sql => {
    if (sql.includes('AS total')) return [{ total: 2 }];
    return [];
  });
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });
  const query = parseSkinQuery({
    search: 'redline',
    weapon: 'AK-47,AWP',
    collection: 'the_falchion_collection',
    case: 'case-4091',
    source_type: 'souvenir_package',
    rarity: 'Classified,Covert',
    stattrak: 'true',
    souvenir: 'false',
    float_min: '0.07',
    float_max: '0.38',
    wear: 'Minimal Wear,Field-Tested',
    limit: '25',
    offset: '50'
  });

  await service.search(query);

  assert.equal(recorder.calls.length, 2);
  const listCall = recorder.calls.find(call => call.sql.includes('LIMIT :limit'));
  const countCall = recorder.calls.find(call => call.sql.includes('AS total'));
  assert.ok(listCall);
  assert.ok(countCall);
  assert.match(listCall.sql, /s\.weapon_name IN \(:weapons\)/);
  assert.match(listCall.sql, /EXISTS[\s\S]+skin_collections selected_sc/);
  assert.match(listCall.sql, /EXISTS[\s\S]+skin_cases selected_case/);
  assert.match(listCall.sql, /source_case\.source_type IN \(:sourceTypes\)/);
  assert.match(listCall.sql, /s\.rarity_name IN \(:rarities\)/);
  assert.match(listCall.sql, /s\.stattrak = :stattrak/);
  assert.match(listCall.sql, /s\.souvenir = :souvenir/);
  assert.match(listCall.sql, /s\.max_float >= :floatMin/);
  assert.match(listCall.sql, /s\.min_float <= :floatMax/);
  assert.equal(listCall.sql.includes('AK-47'), false);
  assert.equal(listCall.options.replacements.search, '%redline%');
  assert.deepEqual(listCall.options.replacements.weapons, ['AK-47', 'AWP']);
  assert.deepEqual(listCall.options.replacements.collections, ['the_falchion_collection']);
  assert.deepEqual(listCall.options.replacements.cases, ['case-4091']);
  assert.deepEqual(listCall.options.replacements.sourceTypes, ['souvenir_package']);
  assert.deepEqual(listCall.options.replacements.rarities, ['Classified', 'Covert']);
  assert.equal(listCall.options.replacements.stattrak, true);
  assert.equal(listCall.options.replacements.souvenir, false);
  assert.equal(listCall.options.replacements.limit, 25);
  assert.equal(listCall.options.replacements.offset, 50);
  assert.equal('limit' in countCall.options.replacements, false);
  assert.equal('offset' in countCall.options.replacements, false);
  assert.equal(countCall.options.replacements.search, '%redline%');
});

test('half-open and closed wear ranges use different upper comparisons', async () => {
  for (const [wear, expected, excluded] of [
    ['Factory New', 's.min_float < :wearMax0', 's.min_float <= :wearMax0'],
    ['Battle-Scarred', 's.min_float <= :wearMax0', 's.min_float < :wearMax0']
  ]) {
    const recorder = queryRecorder(sql => sql.includes('AS total') ? [{ total: 0 }] : []);
    const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });

    await service.search(parseSkinQuery({ wear }));

    const listSql = recorder.calls.find(call => call.sql.includes('LIMIT :limit')).sql;
    assert.equal(listSql.includes(expected), true);
    assert.equal(listSql.includes(excluded), false);
  }
});

test('multiple wear values are ORed inside one ANDed group', async () => {
  const recorder = queryRecorder(sql => sql.includes('AS total') ? [{ total: 0 }] : []);
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });

  await service.search(parseSkinQuery({ weapon: 'AK-47', wear: 'Factory New,Minimal Wear' }));

  const listSql = recorder.calls.find(call => call.sql.includes('LIMIT :limit')).sql;
  assert.match(
    listSql,
    /AND \(\(s\.max_float >= :wearMin0 AND s\.min_float < :wearMax0\) OR \(s\.max_float >= :wearMin1 AND s\.min_float < :wearMax1\)\)/
  );
});

test('search maps relationships and derives available wear names', async () => {
  const recorder = queryRecorder(sql => {
    if (sql.includes('AS total')) return [{ total: '1' }];
    return [{
      id: 'skin-1',
      name: 'AK-47 | Redline',
      weapon: 'AK-47',
      rarity: 'Classified',
      rarityColor: '#d32ce6',
      category: 'Rifles',
      min_float: '0.10',
      max_float: '0.70',
      stattrak: true,
      souvenir: false,
      image: null,
      phase: null,
      description: 'A red rifle.',
      collections: [{ id: 'the_phoenix_collection', name: 'The Phoenix Collection' }],
      cases: [{ id: 'case-1', name: 'Phoenix Case', sourceType: 'case' }]
    }];
  });
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });

  const result = await service.search(parseSkinQuery({ limit: '1' }));

  assert.equal(result.total, 1);
  assert.deepEqual(result.items[0], {
    id: 'skin-1',
    name: 'AK-47 | Redline',
    weapon: 'AK-47',
    rarity: 'Classified',
    rarityColor: '#d32ce6',
    category: 'Rifles',
    min_float: 0.1,
    max_float: 0.7,
    stattrak: true,
    souvenir: false,
    image: null,
    phase: null,
    description: 'A red rifle.',
    collections: [{ id: 'the_phoenix_collection', name: 'The Phoenix Collection' }],
    cases: [{ id: 'case-1', name: 'Phoenix Case', sourceType: 'case' }],
    availableWears: ['Minimal Wear', 'Field-Tested', 'Well-Worn', 'Battle-Scarred']
  });
});

test('null relationship aggregates map to empty arrays', async () => {
  const recorder = queryRecorder(sql => {
    if (sql.includes('AS total')) return [{ total: 1 }];
    return [{ id: 'skin-1', min_float: 0, max_float: 1, collections: null, cases: null }];
  });
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });

  const result = await service.search(parseSkinQuery({ limit: '1' }));

  assert.deepEqual(result.items[0].collections, []);
  assert.deepEqual(result.items[0].cases, []);
});

test('filter options use one query and preserve authoritative values', async () => {
  const recorder = queryRecorder(() => [{ options: {
    weapons: ['AK-47', 'AWP'],
    collections: [{ id: 'the_falchion_collection', name: 'The Falchion Collection' }],
    cases: [{ id: 'case-4091', name: 'Falchion Case', sourceType: 'case' }],
    sourceTypes: ['case', 'souvenir_package'],
    rarities: ['Classified', 'Covert']
  } }]);
  const service = createSkinService({ sequelize: recorder.sequelize, Skin: {} });

  const result = await service.filterOptions();

  assert.equal(recorder.calls.length, 1);
  assert.match(recorder.calls[0].sql, /jsonb_build_object/);
  assert.deepEqual(result.weapons, ['AK-47', 'AWP']);
  assert.deepEqual(result.collections[0], {
    id: 'the_falchion_collection',
    name: 'The Falchion Collection'
  });
  assert.equal(result.wears.length, 5);
  assert.deepEqual(result.wears[0], {
    name: 'Factory New',
    min: 0,
    max: 0.07,
    maxInclusive: false
  });
});

