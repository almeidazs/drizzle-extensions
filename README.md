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
	postgres: { extension: 'pg_trgm' },
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

The `postgres.extension` value is metadata in this release. Installing
PostgreSQL extensions is intentionally left to migrations or database setup.
