# drizzle-extensions

Typed PostgreSQL extension helpers for Drizzle ORM.

`drizzle-extensions` composes PostgreSQL-specific behavior onto a Drizzle
client without changing its base client or replacing Drizzle's schema APIs.
Extensions add methods to eligible relational query builders at
`db.query.<table>` and preserve the table and selected-result types.

Install it alongside `drizzle-orm`. The package supports PostgreSQL Drizzle
clients such as postgres-js, node-postgres, Neon, PGlite, and the PostgreSQL
proxy driver.

## Basic usage

Pass extension instances to `$extends()`. For example, pgvector adds a useful
nearest-neighbor API only to tables that have a native Drizzle vector column:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { integer, pgTable, vector as vectorColumn } from 'drizzle-orm/pg-core'
import { $extends } from 'drizzle-extensions'
import { vector } from 'drizzle-extensions/vector'

const documents = pgTable('documents', {
	id: integer().primaryKey(),
	embedding: vectorColumn({ dimensions: 1536 }).notNull(),
})

const base = drizzle(client, { schema: { documents } })
const db = $extends(base, { extensions: [vector()] })

const results = await db.query.documents.nearest({
	vector: embedding,
	include: { similarity: true },
})
```

`$extends()` returns a new client and never changes the base client. It checks
that extension methods do not collide with Drizzle or each other.

## Creating an extension

Use `defineExtension()` for extension metadata and table methods. A `table`
factory receives the extended client and its original schema table. The factory
must be synchronous, but its methods may be asynchronous. Extensions can also
declare `requires` dependencies by name or definition.

The `postgres` metadata drives installation SQL available at
`db.$extensions.generate()`. It only returns SQL; it never writes migration
files or executes statements. `db.$extensions.names` is an immutable,
configuration-ordered list of extension names.

Every extension has its own documentation in its source directory. See
[`src/extensions/vector/README.md`](src/extensions/vector/README.md) for the
pgvector API, supported options, SQL helpers, indexes, and runtime metadata.
