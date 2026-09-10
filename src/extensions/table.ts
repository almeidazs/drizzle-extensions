import type {
	ExtensionColumnRequirement,
	ExtensionColumnType,
	TableMethod,
	TableMethodDefinition,
	TableMethodsTemplate,
} from '../types'

const columnTypes = {
	anyVector: ['PgVector', 'PgHalfVector', 'PgSparseVector', 'PgBinaryVector'],
	bit: ['PgBinaryVector'],
	halfvec: ['PgHalfVector'],
	sparsevec: ['PgSparseVector'],
	vector: ['PgVector'],
} as const

/** Creates a column requirement for a declarative table method. */
export function type<const TType extends ExtensionColumnType>(
	name: TType,
): ExtensionColumnRequirement<TType> {
	return {
		columnTypes: columnTypes[
			name
		] as unknown as ExtensionColumnRequirement<TType>['columnTypes'],
		name,
		type: 'column-type',
	}
}

/** Normalizes a declarative method while preserving its type template. */
export function defineTableMethod<
	const TType extends ExtensionColumnType,
	TTemplate extends TableMethodsTemplate,
>(definition: TableMethodDefinition<TType>): TableMethod<TType, TTemplate> {
	return {
		...definition,
		type: 'table-method',
	}
}
