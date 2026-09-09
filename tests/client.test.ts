import { expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pg-proxy'

import { $extends } from '../src/index'
import { auditable, createDatabase, searchable } from './fixtures'

test('returns an extended client without mutating the original client', () => {
	const base = createDatabase()
	const database = $extends(base, { extensions: [searchable, auditable] })

	expect(database).not.toBe(base)
	expect(Object.getPrototypeOf(database)).toBe(base)
	expect(database._).toBe(base._)
	expect(database.query).not.toBe(base.query)
	expect(database.query.users).not.toBe(base.query.users)
	expect(database.query.users.findMany).toBe(base.query.users.findMany)
	expect('search' in base.query.users).toBe(false)
})

test('keeps a schema-less client query namespace unchanged', () => {
	const base = drizzle(async () => ({ rows: [] }))
	const database = $extends(base, { extensions: [searchable] })

	expect(database).not.toBe(base)
	expect(Object.getPrototypeOf(database)).toBe(base)
	expect(database.query).toBe(base.query)
})
