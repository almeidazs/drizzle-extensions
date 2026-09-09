import { generateExtensionsSql } from '../shared/extensions-sql'
import { extendQuery } from '../shared/query'
import type {
	AnyPgDatabase,
	ExtendedDatabase,
	ExtendsOptions,
	Extension,
	ExtensionsMetadata,
} from '../types'
import type { RuntimeQuery } from '../types/extensions'

/**
 * Adds extension methods to each relational query builder without mutating the
 * supplied Drizzle client.
 */
export function $extends<
	TDatabase extends AnyPgDatabase,
	const TExtensions extends readonly Extension[],
>(
	database: TDatabase,
	options: ExtendsOptions<TExtensions>,
): ExtendedDatabase<TDatabase, TExtensions> {
	const extendedDatabase = Object.create(database) as ExtendedDatabase<
		TDatabase,
		TExtensions
	>
	const names = Object.freeze(
		options.extensions.map((extension) => extension.name),
	)
	const sql = generateExtensionsSql(options.extensions)
	const extensions: ExtensionsMetadata<TExtensions> = Object.freeze({
		generate: () => sql,
		names,
	})

	Object.defineProperty(extendedDatabase, '$extensions', {
		configurable: true,
		enumerable: true,
		value: extensions,
		writable: false,
	})

	if (database._.schema) {
		const query = Object.create(database.query) as RuntimeQuery

		Object.defineProperty(extendedDatabase, 'query', {
			configurable: true,
			enumerable: true,
			value: query,
			writable: true,
		})

		extendQuery(database, extendedDatabase, options.extensions, query)
	}

	return extendedDatabase
}
