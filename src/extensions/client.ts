import { generateExtensionsSql } from '../shared/extensions-sql'
import { extendQuery } from '../shared/query'
import type {
	AnyPgDatabase,
	ExtendedDatabase,
	ExtendsOptions,
	Extension,
	ExtensionsMetadata,
	GenerateExtensionsOptions,
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
	for (const extension of options.extensions) {
		for (const requiredExtension of extension.requires ?? []) {
			const requiredName =
				typeof requiredExtension === 'string'
					? requiredExtension
					: requiredExtension.name

			if (options.extensions.some(({ name }) => name === requiredName)) continue

			throw new Error(
				`Extension "${extension.name}" requires extension "${requiredName}" to be configured.`,
			)
		}
	}

	const extendedDatabase = Object.create(database) as ExtendedDatabase<
		TDatabase,
		TExtensions
	>
	const configuredExtensions = Object.freeze(
		options.extensions.map((extension) =>
			Object.freeze({
				...extension,
				postgres: Object.freeze({ ...extension.postgres }),
			}),
		),
	)
	const names = Object.freeze(
		configuredExtensions.map((extension) => extension.name),
	)
	const sql = generateExtensionsSql(configuredExtensions)
	const extensions: ExtensionsMetadata<TExtensions> = Object.freeze({
		generate: (generateOptions: GenerateExtensionsOptions | undefined) =>
			generateOptions?.enforceMinimumVersion
				? generateExtensionsSql(configuredExtensions, generateOptions)
				: sql,
		names,
		...Object.fromEntries(
			configuredExtensions.flatMap((extension) =>
				extension.lifecycle
					? [
							[
								extension.name,
								Object.freeze({
									info: () => extension.lifecycle?.info(extendedDatabase),
								}),
							],
						]
					: [],
			),
		),
	}) as ExtensionsMetadata<TExtensions>

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
