import { integer, pgTable, text, vector } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pg-proxy'

import { defineExtension } from '../src/index'

export const users = pgTable('users', {
	name: text().notNull(),
})

export const posts = pgTable('posts', {
	title: text().notNull(),
})

export const schema = { posts, users }

export const documents = pgTable('documents', {
	embedding: vector({ dimensions: 3 }).notNull(),
	id: integer().primaryKey(),
	title: text().notNull(),
})

export const vectorSchema = { documents, users }

export function createDatabase() {
	return drizzle(async () => ({ rows: [] }), { schema })
}

export function createVectorDatabase(
	queries: { params: unknown[]; sql: string }[],
) {
	return drizzle(
		async (sql, params) => {
			queries.push({ params, sql })
			return { rows: [] }
		},
		{ schema: vectorSchema },
	)
}

export const searchable = defineExtension({
	name: 'searchable',
	postgres: { extension: 'pg_trgm', version: '>=1.6' },
	table({ db, table }) {
		return {
			search: async (query: string) => ({ db, query, table }),
		}
	},
})

export const auditable = defineExtension({
	name: 'auditable',
	postgres: { extension: 'audit', version: '>=1.0' },
	table() {
		return {
			auditLabel: () => 'auditable',
		}
	},
})
