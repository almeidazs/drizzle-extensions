import { expect, test } from 'bun:test'

import { $extends, defineExtension, type Extension } from '../src/index'
import { createDatabase, searchable } from './fixtures'

test('rejects methods that overwrite methods from another extension', () => {
	const duplicate = defineExtension({
		name: 'duplicate',
		postgres: { extension: 'duplicate' },
		table() {
			return { search: () => undefined }
		},
	})

	expect(() =>
		$extends(createDatabase(), { extensions: [searchable, duplicate] }),
	).toThrow(
		'Extension "duplicate" cannot add "search" to "posts": the method already exists.',
	)
})

test('rejects methods that overwrite Drizzle query-builder methods', () => {
	const conflicting = defineExtension({
		name: 'conflicting',
		postgres: { extension: 'conflicting' },
		table() {
			return { findMany: () => undefined }
		},
	})

	expect(() =>
		$extends(createDatabase(), { extensions: [conflicting] }),
	).toThrow(
		'Extension "conflicting" cannot add "findMany" to "posts": the method already exists.',
	)
})

test('rejects non-function factory results from JavaScript callers', () => {
	const invalid = {
		name: 'invalid',
		postgres: { extension: 'invalid' },
		table: () => ({ invalid: 'not a function' }),
	} as unknown as Extension

	expect(() => $extends(createDatabase(), { extensions: [invalid] })).toThrow(
		'Extension "invalid" must return functions from its table factory.',
	)
})

test('rejects asynchronous table factories from JavaScript callers', () => {
	const invalid = {
		name: 'async',
		postgres: { extension: 'async' },
		table: async () => ({ search: () => undefined }),
	} as unknown as Extension

	expect(() => $extends(createDatabase(), { extensions: [invalid] })).toThrow(
		'Extension "async" must define a synchronous table factory.',
	)
})

test('rejects callable thenables from JavaScript callers', () => {
	// biome-ignore lint/suspicious/noThenProperty: regression test for callable thenables
	const thenable = Object.assign(() => undefined, { then: () => undefined })
	const invalid = {
		name: 'callable-thenable',
		postgres: { extension: 'callable-thenable' },
		table: () => thenable,
	} as unknown as Extension

	expect(() => $extends(createDatabase(), { extensions: [invalid] })).toThrow(
		'Extension "callable-thenable" must define a synchronous table factory.',
	)
})
