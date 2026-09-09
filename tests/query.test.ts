import { expect, test } from 'bun:test'

import { $extends } from '../src/index'
import { auditable, createDatabase, posts, searchable, users } from './fixtures'

test('adds every extension method to every relational query builder', async () => {
	const database = $extends(createDatabase(), {
		extensions: [searchable, auditable],
	})

	expect(database.query.users.auditLabel()).toBe('auditable')
	expect(database.query.posts.auditLabel()).toBe('auditable')

	const userResult = await database.query.users.search('John')
	expect(userResult).toEqual({ db: database, query: 'John', table: users })

	const postResult = await database.query.posts.search('Drizzle')
	expect(postResult).toEqual({ db: database, query: 'Drizzle', table: posts })
})
