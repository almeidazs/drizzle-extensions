import { expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'

import { vector } from '../src/extensions/vector'
import { $extends } from '../src/index'
import { createVectorDatabase } from './fixtures'

test('runs a nearest-neighbor query with a string column name and selection map', async () => {
	const queries: { params: unknown[]; sql: string }[] = []
	const database = $extends(createVectorDatabase(queries), {
		extensions: [vector()],
	})

	await database.query.documents.nearest({
		by: 'embedding',
		limit: 3,
		metric: 'l2',
		select: { id: true, title: true },
		vector: [0.1, 0.2, 0.3],
		where: (table, { eq }) => eq(table.title, 'Drizzle'),
	})

	expect(queries).toHaveLength(1)
	expect(queries[0]?.sql).toContain('order by "documents"."embedding" <-> $2')
	expect(queries[0]?.sql).toContain('where "documents"."title" = $1')
	expect(queries[0]?.params).toEqual(['Drizzle', '[0.1,0.2,0.3]', 3])
})

test('adds computed distance and similarity and applies semantic thresholds', async () => {
	const queries: { params: unknown[]; sql: string }[] = []
	const database = $extends(createVectorDatabase(queries), {
		extensions: [vector()],
	})

	await database.query.documents.nearest({
		include: { distance: true, similarity: true },
		maxDistance: 0.4,
		minSimilarity: 0.8,
		vector: sql`'[0.1,0.2,0.3]'::vector`,
	})

	expect(queries[0]?.sql).toContain('as "distance"')
	expect(queries[0]?.sql).toContain('as "similarity"')
	expect(queries[0]?.params).toEqual([0.4, 0.8, 10])
})

test('uses configured defaults and validates dense input', async () => {
	const queries: { params: unknown[]; sql: string }[] = []
	const database = $extends(createVectorDatabase(queries), {
		extensions: [vector({ defaults: { limit: 2, metric: 'l2' } })],
	})

	await database.query.documents.nearest({ vector: [0.1, 0.2, 0.3] })
	expect(queries[0]?.sql).toContain(' <-> ')
	expect(queries[0]?.params).toEqual(['[0.1,0.2,0.3]', 2])
	expect(() =>
		database.query.documents.nearest({ vector: [1, Number.NaN, 3] }),
	).toThrow('Vector values must be finite numbers.')
})

test('runs record-relative and explicit radius searches', async () => {
	const queries: { params: unknown[]; sql: string }[] = []
	const database = $extends(createVectorDatabase(queries), {
		extensions: [vector()],
	})

	await database.query.documents.similarTo({ record: { id: 1 } })
	await database.query.documents.withinDistance({
		maxDistance: 0.5,
		metric: 'l2',
		vector: [0.1, 0.2, 0.3],
	})

	expect(queries[0]?.sql).toContain('select "embedding" from "documents"')
	expect(queries[1]?.sql).toContain('< $2')
})

test('generates pgvector installation SQL and applies methods only to vector tables', () => {
	const database = $extends(createVectorDatabase([]), {
		extensions: [vector()],
	})

	expect(database.$extensions.names).toEqual(['vector'])
	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "vector";',
	)
	expect('nearest' in database.query.documents).toBe(true)
	expect('nearest' in database.query.users).toBe(false)
})

test('exposes pgvector installation information through extension metadata', async () => {
	const queries: { params: unknown[]; sql: string }[] = []
	const database = $extends(createVectorDatabase(queries), {
		extensions: [vector()],
	})

	const info = await database.$extensions.vector.info()

	expect(info.installed).toBe(false)
	expect(info.capabilities.iterativeScan).toBe(false)
	expect(queries[0]?.sql).toContain('from pg_extension')
})
