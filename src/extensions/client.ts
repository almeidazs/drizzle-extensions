import { extendQuery } from '../shared/query'
import type {
	AnyPgDatabase,
	ExtendedDatabase,
	ExtendsOptions,
	Extension,
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
