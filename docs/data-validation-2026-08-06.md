# Skinrush Data Validation Report

Validation source: `D:\skinrush-api-database-files`

No data was imported or changed.

## Export counts

| File | Rows |
| --- | ---: |
| `skins.csv` | 1,475 |
| `collections.csv` | 35 |
| `skin_collections.csv` | 2,477 |
| `cases.csv` | 186 |
| `skin_cases.csv` | 418 |

The validator normalised 7,157 literal `NULL` values while reading the files.

## Blocking findings

| Finding | Count |
| --- | ---: |
| Skin-collection links referencing a missing collection | 1,795 |
| Duplicate skin-collection links | 826 |
| Skin-case links referencing a missing case | 74 |

The orphaned collection links contain 140 distinct missing IDs. Examples
include `the_overpass_2024_collection`, `the_canals_collection`,
`the_vertigo_collection`, and `the_graphic_design_collection`. Near the end of
`skin_collections.csv`, collection IDs change from slugs to bare numbers. This
indicates that the relationship export likely combines incompatible data
generations.

The orphaned case links contain eight distinct missing case IDs:
`case-4288`, `case-4352`, `case-4471`, `case-4717`, `case-4747`, `case-4846`,
`case-4880`, and `case-5176`.

Do not import these relationship files into Render in their current state.

## Read-only pgAdmin checks

Use these queries against Render to determine whether the problem exists in the
live database or only in the CSV exports.

```sql
SELECT 'skins' AS table_name, COUNT(*) AS row_count FROM skins
UNION ALL
SELECT 'collections', COUNT(*) FROM collections
UNION ALL
SELECT 'skin_collections', COUNT(*) FROM skin_collections
UNION ALL
SELECT 'cases', COUNT(*) FROM cases
UNION ALL
SELECT 'skin_cases', COUNT(*) FROM skin_cases;
```

```sql
SELECT sc.collection_id, COUNT(*) AS link_count
FROM skin_collections sc
LEFT JOIN collections c ON c.collection_id = sc.collection_id
WHERE c.collection_id IS NULL
GROUP BY sc.collection_id
ORDER BY link_count DESC, sc.collection_id;
```

```sql
SELECT skin_id, collection_id, COUNT(*) AS duplicate_count
FROM skin_collections
GROUP BY skin_id, collection_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, skin_id, collection_id;
```

```sql
SELECT sc.case_id, COUNT(*) AS link_count
FROM skin_cases sc
LEFT JOIN cases c ON c.case_id = sc.case_id
WHERE c.case_id IS NULL
GROUP BY sc.case_id
ORDER BY link_count DESC, sc.case_id;
```

If the live database passes these checks, create fresh CSV exports for all five
tables from the same database snapshot. If it fails, repair the source tables
inside a transaction after taking a Render backup; do not infer missing names
or convert numeric collection IDs automatically.

