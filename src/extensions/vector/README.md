# `drizzle-extensions/vector`

Typed pgvector support for Drizzle PostgreSQL clients.

The extension adds nearest-neighbor methods to `db.query.<table>` when a table
has Drizzle's native `vector`, `halfvec`, `sparsevec`, or `bit` column. Drizzle
continues to own schema columns; this package provides queries, SQL helpers,
indexes, validation, and extension metadata.

## Setup

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { integer, pgTable, vector as vectorColumn } from 'drizzle-orm/pg-core'
import { $extends } from 'drizzle-extensions'
import { vector } from 'drizzle-extensions/vector'

const documents = pgTable('documents', {
	id: integer().primaryKey(),
	embedding: vectorColumn({ dimensions: 1536 }).notNull(),
})

const db = $extends(drizzle(client, { schema: { documents } }), {
	extensions: [
		vector({
			defaults: { limit: 10, metric: 'cosine' },
			validation: { dimensions: true, finite: true },
		}),
	],
})
```

`vector()` declares pgvector `>=0.8.0`. Generate installation SQL using
`db.$extensions.generate()`.

## Table API

### `nearest()`

Ranks rows by a pgvector distance. Omit `by` when the table has one vector
column; otherwise it is required and autocompletes only eligible columns.

```ts
const results = await db.query.documents.nearest({
	by: 'embedding',
	vector: embedding,
	metric: 'cosine',
	limit: 20,
	offset: 0,
	where: (documents, { and, eq }) =>
		and(eq(documents.tenantId, tenantId), eq(documents.published, true)),
	select: { id: true, title: true },
	include: { distance: true, similarity: true },
	minSimilarity: 0.8,
})
```

Options:

- `by`: vector-column name, required only when the table is ambiguous.
- `vector`: query value or Drizzle `SQL` expression.
- `metric`: ranking metric compatible with that column type.
- `limit` and `offset`: pagination; limit defaults to `10`.
- `where`: table plus common Drizzle predicate operators.
- `select`: boolean map of returned table columns.
- `include.distance`: adds the ranking distance to each result.
- `include.similarity`: adds cosine similarity; only valid with `cosine`.
- `maxDistance`: metric-distance filter.
- `minSimilarity`: cosine-only semantic filter.

The result type reflects `select`, `include.distance`, and
`include.similarity`.

### `similarTo()`

Finds rows nearest to another record's stored vector and excludes that source
record from the result:

```ts
const related = await db.query.documents.similarTo({
	by: 'embedding',
	record: { id: documentId },
	limit: 10,
})
```

### `withinDistance()`

An explicit radius query. It accepts `nearest()` options and requires
`maxDistance`:

```ts
const nearby = await db.query.documents.withinDistance({
	vector: embedding,
	metric: 'l2',
	maxDistance: 0.35,
})
```

## Types, inputs, and metrics

| Column family | Input | Metrics |
| --- | --- | --- |
| `vector`, `halfvec` | `readonly number[]` or `SQL` | `cosine`, `l2`, `innerProduct`, `l1` |
| `sparsevec` | `SparseVectorInput` or `SQL` | `cosine`, `l2`, `innerProduct`, `l1` |
| `bit` | bit string or `SQL` | `hamming`, `jaccard` |

Sparse inputs use a JavaScript object rather than a pgvector literal:

```ts
const sparse = { dimensions: 5, values: { 1: 1, 3: 2, 5: 3 } }
```

Validation defaults to `{ dimensions: true, finite: true }`, rejecting
non-finite values and dimension mismatches for columns that declare dimensions.

## Extension options

```ts
vector({
	defaults: { limit: 20, metric: 'cosine' },
	methods: { nearest: 'search' },
	minVersion: '>=0.8.0',
	validation: { dimensions: true, finite: true },
})
```

- `defaults`: fallback `metric` and `limit`.
- `methods`: optional names for `nearest`, `similarTo`, and `withinDistance`.
- `minVersion`: declared pgvector version used by migration SQL.
- `validation`: JavaScript input checks.

Renamed methods cannot collide with Drizzle or another configured extension.

## SQL helpers

```ts
import {
	avgVector,
	cosineSimilarity,
	l2Distance,
	normalize,
	subvector,
} from 'drizzle-extensions/vector'
```

- Distances: `l2Distance`, `l1Distance`, `cosineDistance`,
  `cosineSimilarity`, `negativeInnerProduct`, `innerProduct`,
  `hammingDistance`, `jaccardDistance`.
- Arithmetic: `add`, `subtract`, `multiply`, `concat`.
- Transformations: `normalize`, `norm`, `dimensions`, `subvector`,
  `binaryQuantize`.
- Aggregates: `avgVector`, `sumVector`.

`negativeInnerProduct()` maps to `<#>` exactly; `innerProduct()` returns its
positive semantic counterpart.

## Approximate indexes

`vectorIndex`, `hnsw`, and `ivfflat` produce Drizzle index configurations with
the appropriate pgvector operator class:

```ts
import { hnsw, ivfflat } from 'drizzle-extensions/vector'

const documents = pgTable(
	'documents',
	{ embedding: vectorColumn({ dimensions: 1536 }).notNull() },
	(table) => [
		hnsw('documents_embedding_hnsw', {
			column: table.embedding,
			metric: 'cosine',
			m: 16,
			efConstruction: 64,
		}),
		ivfflat('documents_embedding_ivfflat', {
			column: table.embedding,
			metric: 'cosine',
			lists: 100,
		}),
	],
)
```

Use `vectorIndex(name, { column, using, metric })` for the generic helper.
Unsupported IVFFlat `l1` and `sparsevec` combinations are rejected at runtime.

## Runtime metadata

```ts
const info = await db.$extensions.vector.info()

// { installed, version, capabilities: { hnsw, ivfflat, halfvec, ... } }
```

`info()` reads `pg_extension`; it does not install or modify pgvector.
