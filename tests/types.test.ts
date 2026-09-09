import type { AwsDataApiPgDatabase } from 'drizzle-orm/aws-data-api/pg'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import type { NeonDatabase as NeonServerlessDatabase } from 'drizzle-orm/neon-serverless'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { AnyPgTable } from 'drizzle-orm/pg-core'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { VercelPgDatabase } from 'drizzle-orm/vercel-postgres'

import {
	$extends,
	type AnyPgDatabase,
	type Extension,
	type ExtensionDefinition,
} from '../src/index'
import { auditable, createDatabase, type schema, searchable } from './fixtures'

function expectType<TValue>(_value: TValue): void {}

function assertDriverCompatibility<TDatabase extends AnyPgDatabase>(): void {
	expectType<AnyPgDatabase>(null as unknown as TDatabase)
}

const base = createDatabase()
const database = $extends(base, { extensions: [searchable, auditable] })

expectType<
	(
		query: string,
	) => Promise<{ db: AnyPgDatabase; query: string; table: AnyPgTable }>
>(database.query.users.search)
expectType<() => string>(database.query.users.auditLabel)
expectType<'extension'>(searchable.type)
expectType<Extension>(searchable)
expectType<ExtensionDefinition>({
	name: 'definition',
	postgres: { extension: 'definition' },
})
expectType<false>(
	false as 'search' extends keyof typeof base.query.users ? true : false,
)

assertDriverCompatibility<AwsDataApiPgDatabase<typeof schema>>()
assertDriverCompatibility<NeonHttpDatabase<typeof schema>>()
assertDriverCompatibility<NeonServerlessDatabase<typeof schema>>()
assertDriverCompatibility<NodePgDatabase<typeof schema>>()
assertDriverCompatibility<PgliteDatabase<typeof schema>>()
assertDriverCompatibility<PostgresJsDatabase<typeof schema>>()
assertDriverCompatibility<VercelPgDatabase<typeof schema>>()
