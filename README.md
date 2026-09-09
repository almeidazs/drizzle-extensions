# drizzle-extensions

Typed PostgreSQL extension helpers for Drizzle ORM.

Install it alongside a supported PostgreSQL Drizzle driver. `drizzle-extensions`
declares `drizzle-orm@>=0.30.0` as a peer dependency and works with its
PostgreSQL database clients, including `postgres-js`, `node-postgres`, Neon,
PGlite, and the PostgreSQL proxy driver.

## Extending relational queries

Define an extension and compose it with a PostgreSQL Drizzle client that was
created with a schema. A schema is required for table methods, because they are
attached to `db.query.<table>`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { $extends, defineExtension } from 'drizzle-extensions'

const searchable = defineExtension({
	name: 'searchable',
	postgres: { extension: 'pg_trgm', version: '>=1.6' },
	table({ db, table }) {
		return {
			async search(query: string) {
				return db.select().from(table)
			},
		}
	},
})

const base = drizzle(client, { schema })
const db = $extends(base, { extensions: [searchable] })

await db.query.users.search('John')
```

`$extends()` returns a new client and never changes the base client. Each
extension's `table` factory runs once for every relational table and receives
the extended client plus the original schema table. Factories must be
synchronous, although their returned methods may be async. Extensions cannot
overwrite one another or Drizzle query-builder methods.

The `postgres` configuration records the extension identifier and its minimum
supported version. It is metadata in this release: installing PostgreSQL
extensions and checking their installed versions are left to migrations or
database setup.

Use `requires` to declare extensions that must be passed to `$extends` together.
Entries can be extension names or other extension definitions:

```ts
const awesomeSearch = defineExtension({
	name: 'awesome-search',
	postgres: { extension: 'awesome_search', version: '>=1.6' },
	requires: ['pg-trgm', unaccent],
})
```

## Extension metadata and migration SQL

The extended client exposes the configured extensions through `$extensions`:

```ts
db.$extensions.names
// ['searchable']

db.$extensions.generate()
// CREATE EXTENSION IF NOT EXISTS "pg_trgm";

db.$extensions.generate({ enforceMinimumVersion: true })
// Verifies the installed or available extension version before creating it.
```

`names` is an immutable snapshot of the public extension names in configuration
order. `generate()` returns a snapshot of the PostgreSQL installation SQL; it
uses `postgres.extension`, quotes identifiers safely, and emits duplicate
extension identifiers only once. It does not write files or execute SQL.

Pass `{ enforceMinimumVersion: true }` to generate `DO` blocks that check the
installed extension version, or its available default version before creation,
against `postgres.version`. If the version is too old or unavailable, the block
raises an error without creating the extension. Version checks support numeric
dot-separated versions such as `>=1.6`.
