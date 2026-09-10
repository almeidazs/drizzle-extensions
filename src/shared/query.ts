import type { AnyPgTable } from 'drizzle-orm/pg-core'
import { getTableColumns } from 'drizzle-orm/utils'

import type {
	AnyPgDatabase,
	Extension,
	ExtensionTableContext,
	RuntimeQuery,
	TableMethod,
	TableMethodDefinitions,
} from '../types/extensions'
import { isThenable } from './is-thenable'

type RuntimeTableMethod = TableMethod & {
	readonly execute: (
		context: ExtensionTableContext,
		...arguments_: unknown[]
	) => unknown
}

function isTableMethod(value: unknown): value is RuntimeTableMethod {
	return (
		typeof value === 'object' &&
		value !== null &&
		'value' in value === false &&
		(value as { type?: unknown }).type === 'table-method' &&
		typeof (value as { execute?: unknown }).execute === 'function'
	)
}

function supportsTable(method: RuntimeTableMethod, table: AnyPgTable): boolean {
	return Object.values(getTableColumns(table)).some((column) =>
		method.columns.columnTypes.includes(column.columnType as never),
	)
}

function addMethod(
	extension: Extension,
	tableName: string,
	queryBuilder: RuntimeQuery[string],
	methodName: string,
	method: (...arguments_: never[]) => unknown,
): void {
	if (methodName in queryBuilder)
		throw new Error(
			`Extension "${extension.name}" cannot add "${methodName}" to "${tableName}": the method already exists.`,
		)

	queryBuilder[methodName] = method
}

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
			if (!extension.table) continue

			if (typeof extension.table !== 'function') {
				for (const [methodName, method] of Object.entries(
					extension.table as TableMethodDefinitions,
				)) {
					if (!isTableMethod(method))
						throw new TypeError(
							`Extension "${extension.name}" must define table methods with defineTableMethod().`,
						)

					if (!supportsTable(method, table)) continue

					addMethod(
						extension,
						tableName,
						queryBuilder,
						methodName,
						(...arguments_: never[]) => method.execute(context, ...arguments_),
					)
				}

				continue
			}

			const methods = extension.table(context)

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

				addMethod(extension, tableName, queryBuilder, methodName, method)
			}
		}
	}
}
