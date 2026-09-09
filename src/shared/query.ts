import type { AnyPgTable } from 'drizzle-orm/pg-core'

import type {
	AnyPgDatabase,
	Extension,
	ExtensionTableContext,
	RuntimeQuery,
} from '../types/extensions'
import { isThenable } from './is-thenable'

/** Composes extension methods into a cloned relational-query namespace. */
export function extendQuery(
	database: AnyPgDatabase,
	extendedDatabase: AnyPgDatabase,
	extensions: readonly Extension[],
	query: RuntimeQuery,
): void {
	const { schema } = database._

	if (!schema) return

	const baseQuery = database.query as RuntimeQuery

	for (const tableName of Object.keys(schema)) {
		const originalQueryBuilder = baseQuery[tableName]

		if (!originalQueryBuilder) continue

		const queryBuilder = Object.create(
			originalQueryBuilder,
		) as RuntimeQuery[string]

		query[tableName] = queryBuilder

		const table = database._.fullSchema[tableName] as AnyPgTable

		for (const extension of extensions) {
			const context: ExtensionTableContext = { db: extendedDatabase, table }
			const methods = extension.table?.(context)

			if (isThenable(methods))
				throw new TypeError(
					`Extension "${extension.name}" must define a synchronous table factory.`,
				)

			if (!methods) continue

			for (const [methodName, method] of Object.entries(methods)) {
				if (typeof method !== 'function')
					throw new TypeError(
						`Extension "${extension.name}" must return functions from its table factory.`,
					)

				if (methodName in queryBuilder)
					throw new Error(
						`Extension "${extension.name}" cannot add "${methodName}" to "${tableName}": the method already exists.`,
					)

				queryBuilder[methodName] = method
			}
		}
	}
}
