import { expect, test } from 'bun:test'

import { $extends, defineExtension, type Extension } from '../src/index'
import { auditable, createDatabase, searchable } from './fixtures'

test('exposes configured extension names without mutating the base client', () => {
	const base = createDatabase()
	const database = $extends(base, { extensions: [searchable, auditable] })

	expect('$extensions' in base).toBe(false)
	expect(database.$extensions.names).toEqual(['searchable', 'auditable'])
	expect(Object.isFrozen(database.$extensions.names)).toBe(true)
	expect(Object.isFrozen(database.$extensions)).toBe(true)
})

test('generates installation SQL from PostgreSQL extension identifiers', () => {
	const database = $extends(createDatabase(), {
		extensions: [searchable, auditable],
	})

	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\nCREATE EXTENSION IF NOT EXISTS "audit";',
	)
})

test('deduplicates installation statements and escapes identifiers', () => {
	const quoted = defineExtension({
		name: 'quoted',
		postgres: { extension: 'quoted"extension' },
	})
	const duplicate = defineExtension({
		name: 'duplicate',
		postgres: { extension: 'pg_trgm' },
	})
	const database = $extends(createDatabase(), {
		extensions: [searchable, duplicate, quoted],
	})

	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\nCREATE EXTENSION IF NOT EXISTS "quoted""extension";',
	)
})

test('generates an empty SQL string when no extensions are configured', () => {
	const database = $extends(createDatabase(), { extensions: [] })

	expect(database.$extensions.names).toEqual([])
	expect(database.$extensions.generate()).toBe('')
})

test('keeps generated SQL stable when the caller mutates its extension array', () => {
	const extensions: Extension[] = [searchable]
	const database = $extends(createDatabase(), { extensions })

	extensions.push(auditable)

	expect(database.$extensions.names).toEqual(['searchable'])
	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
	)
})
