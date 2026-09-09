import { pgTable, text } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pg-proxy'

import { defineExtension } from '../src/index'

export const users = pgTable('users', {
	name: text().notNull(),
})

export const posts = pgTable('posts', {
	title: text().notNull(),
})

export const schema = { posts, users }

export function createDatabase() {
	return drizzle(async () => ({ rows: [] }), { schema })
}

export const searchable = defineExtension({
	name: 'searchable',
	postgres: { extension: 'pg_trgm' },
	table({ db, table }) {
		return {
			search: async (query: string) => ({ db, query, table }),
		}
	},
})

export const auditable = defineExtension({
	name: 'auditable',
	postgres: { extension: 'audit' },
	table() {
		return {
			auditLabel: () => 'auditable',
		}
	},
})
