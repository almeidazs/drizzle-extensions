import {
	and,
	eq,
	getTableColumns,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	ne,
	not,
	notInArray,
	or,
	type SQL,
	type SQLWrapper,
	sql,
} from 'drizzle-orm'
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm/table'

import {
	cosineSimilarity,
	vectorDistance,
	vectorValue,
} from '../../shared/vector'
import type {
	AnyVectorColumn,
	AnyVectorMetric,
	CompatibleVectorMetric,
	ExtensionTableContext,
	SparseVectorInput,
	TableMethodsTemplate,
	VectorDefaults,
	VectorExtensionInfo,
	VectorInclude,
	VectorInput,
	VectorMethodNames,
	VectorOptions,
	VectorQueryResult,
	VectorSelect,
} from '../../types'
import { defineExtension } from '../define'
import { defineTableMethod, type } from '../table'

export { hnsw, ivfflat, vectorIndex } from './indexes'

const whereOperators = {
	and,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	lte,
	ne,
	not,
	notInArray,
	or,
}

type VectorColumns<TTable extends AnyPgTable> = {
	[K in keyof TTable & string]: TTable[K] extends AnyVectorColumn<TTable>
		? K
		: never
}[keyof TTable & string]

type IsUnion<TValue, TWhole = TValue> = TValue extends unknown
	? [TWhole] extends [TValue]
		? false
		: true
	: never

type ByOption<TTable extends AnyPgTable> =
	IsUnion<VectorColumns<TTable>> extends true
		? { readonly by: VectorColumns<TTable> }
		: { readonly by?: VectorColumns<TTable> }

type ColumnFor<TTable extends AnyPgTable, TBy extends VectorColumns<TTable>> =
	TTable[TBy] extends AnyVectorColumn<TTable> ? TTable[TBy] : never

type SimilarityOption<TMetric> = TMetric extends 'cosine' | undefined
	? VectorInclude
	: Omit<VectorInclude, 'similarity'> & { readonly similarity?: never }

type NearestOptions<
	TTable extends AnyPgTable,
	TBy extends VectorColumns<TTable> = VectorColumns<TTable>,
	TMetric extends CompatibleVectorMetric<ColumnFor<TTable, TBy>> | undefined =
		| CompatibleVectorMetric<ColumnFor<TTable, TBy>>
		| undefined,
	TSelect extends VectorSelect<TTable> | undefined = undefined,
	TInclude extends SimilarityOption<TMetric> | undefined = undefined,
> = ByOption<TTable> & {
	readonly vector: VectorInput<ColumnFor<TTable, TBy>>
	readonly metric?: TMetric
	readonly limit?: number
	readonly offset?: number
	readonly where?: (table: TTable, operators: typeof whereOperators) => SQL
	readonly select?: TSelect
	readonly include?: TInclude
	readonly maxDistance?: number
	readonly minSimilarity?: TMetric extends 'cosine' | undefined ? number : never
}

type SimilarToOptions<TTable extends AnyPgTable> = ByOption<TTable> & {
	readonly record: Partial<InferSelectModel<TTable>>
	readonly metric?: AnyVectorMetric
	readonly limit?: number
	readonly offset?: number
	readonly where?: (table: TTable, operators: typeof whereOperators) => SQL
}

type WithinDistanceOptions<TTable extends AnyPgTable> =
	NearestOptions<TTable> & {
		readonly maxDistance: number
	}

interface VectorTableMethods<TTable extends AnyPgTable> {
	nearest<
		TBy extends VectorColumns<TTable> = VectorColumns<TTable>,
		TMetric extends
			| CompatibleVectorMetric<ColumnFor<TTable, TBy>>
			| undefined = undefined,
		TSelect extends VectorSelect<TTable> | undefined = undefined,
		TInclude extends SimilarityOption<TMetric> | undefined = undefined,
	>(
		options: NearestOptions<TTable, TBy, TMetric, TSelect, TInclude>,
	): Promise<VectorQueryResult<TTable, TSelect, TInclude>[]>
	similarTo(
		options: SimilarToOptions<TTable>,
	): Promise<InferSelectModel<TTable>[]>
	withinDistance(
		options: WithinDistanceOptions<TTable>,
	): Promise<InferSelectModel<TTable>[]>
}

interface VectorMethodsTemplate extends TableMethodsTemplate {
	readonly methods: VectorTableMethods<this['table']>
}

function getColumn(table: AnyPgTable, by: string | undefined): AnyPgColumn {
	const columns = Object.values(getTableColumns(table)).filter((column) =>
		['PgVector', 'PgHalfVector', 'PgSparseVector', 'PgBinaryVector'].includes(
			column.columnType,
		),
	)
	const column = by
		? getTableColumns(table)[by]
		: columns.length === 1
			? columns[0]
			: undefined

	if (!column || !columns.includes(column))
		throw new TypeError(
			'Vector queries require `by` when a table has multiple vector columns.',
		)

	return column
}

function getMetrics(column: AnyPgColumn): readonly AnyVectorMetric[] {
	return column.columnType === 'PgBinaryVector'
		? ['hamming', 'jaccard']
		: ['cosine', 'l2', 'innerProduct', 'l1']
}

function validateValue(
	column: AnyPgColumn,
	value: unknown,
	validation: Required<NonNullable<VectorOptions['validation']>>,
): void {
	if (typeof value === 'object' && value !== null && 'getSQL' in value) return
	const dimensions = (column as AnyPgColumn & { readonly dimensions?: number })
		.dimensions
	if (Array.isArray(value)) {
		if (validation.finite && value.some((entry) => !Number.isFinite(entry)))
			throw new TypeError('Vector values must be finite numbers.')
		if (
			validation.dimensions &&
			dimensions !== undefined &&
			value.length !== dimensions
		)
			throw new RangeError(
				`Expected ${dimensions} dimensions, received ${value.length}.`,
			)
		return
	}
	if (
		typeof value === 'object' &&
		value !== null &&
		'dimensions' in value &&
		'values' in value
	) {
		const sparse = value as SparseVectorInput
		if (
			validation.dimensions &&
			dimensions !== undefined &&
			sparse.dimensions !== dimensions
		)
			throw new RangeError(
				`Expected ${dimensions} dimensions, received ${sparse.dimensions}.`,
			)
		if (
			validation.finite &&
			Object.values(sparse.values).some((entry) => !Number.isFinite(entry))
		)
			throw new TypeError('Sparse vector values must be finite numbers.')
	}
}

function selectFields(
	table: AnyPgTable,
	selection: VectorSelect<AnyPgTable> | undefined,
) {
	if (!selection) return getTableColumns(table)
	return Object.fromEntries(
		Object.entries(selection)
			.filter(([, selected]) => selected)
			.map(([name]) => [name, getTableColumns(table)[name]]),
	)
}

interface RuntimeNearestOptions {
	readonly by?: string
	readonly include?: VectorInclude
	readonly limit?: number
	readonly maxDistance?: number
	readonly metric?: AnyVectorMetric
	readonly minSimilarity?: number
	readonly offset?: number
	readonly select?: VectorSelect<AnyPgTable>
	readonly vector: readonly number[] | SparseVectorInput | SQL | string
	readonly where?: (table: AnyPgTable, operators: typeof whereOperators) => SQL
}

interface RuntimeSelectQuery extends SQLWrapper {
	from(table: AnyPgTable): RuntimeSelectQuery
	limit(limit: number): RuntimeSelectQuery
	offset(offset: number): RuntimeSelectQuery
	orderBy(expression: SQL): RuntimeSelectQuery
	where(condition: SQL | undefined): RuntimeSelectQuery
}

interface RuntimeDatabase {
	select(fields: Record<string, unknown>): RuntimeSelectQuery
}

function nearest(
	context: ExtensionTableContext,
	options: RuntimeNearestOptions,
	defaults: Required<VectorDefaults>,
	validation: Required<NonNullable<VectorOptions['validation']>>,
	extraWhere?: SQL,
): unknown {
	const column = getColumn(context.table, options.by)
	const metric = options.metric ?? defaults.metric
	if (!getMetrics(column).includes(metric))
		throw new TypeError(
			`Metric "${metric}" is not compatible with "${column.columnType}".`,
		)
	if (options.minSimilarity !== undefined && metric !== 'cosine')
		throw new TypeError('minSimilarity requires cosine metric.')

	validateValue(column, options.vector, validation)
	const value = vectorValue(options.vector, column)
	const distance = vectorDistance(metric, column, value)
	const conditions = [
		extraWhere,
		options.where?.(context.table, whereOperators),
	]
	if (options.maxDistance !== undefined)
		conditions.push(sql`${distance} < ${options.maxDistance}`)
	if (options.minSimilarity !== undefined)
		conditions.push(
			sql`${cosineSimilarity(column, value)} >= ${options.minSimilarity}`,
		)
	const where = conditions.filter((condition): condition is SQL =>
		Boolean(condition),
	)
	const fields = selectFields(context.table, options.select)
	const selected = {
		...fields,
		...(options.include?.distance ? { distance: distance.as('distance') } : {}),
		...(options.include?.similarity
			? { similarity: cosineSimilarity(column, value).as('similarity') }
			: {}),
	}

	const database = context.db as ExtensionTableContext['db'] & RuntimeDatabase

	return database
		.select(selected)
		.from(context.table)
		.where(where.length > 1 ? and(...where) : where[0])
		.orderBy(distance)
		.limit(options.limit ?? defaults.limit)
		.offset(options.offset ?? 0)
}

function capabilities(
	version: string | undefined,
): VectorExtensionInfo['capabilities'] {
	const iterativeScan = version
		? Number.parseInt(version.split('.')[0] ?? '0', 10) > 0 &&
			Number.parseInt(version.split('.')[1] ?? '0', 10) >= 8
		: false
	return {
		binaryQuantization: Boolean(version),
		halfvec: Boolean(version),
		hnsw: Boolean(version),
		iterativeScan,
		ivfflat: Boolean(version),
		sparsevec: Boolean(version),
	}
}

/** Creates pgvector query methods for native Drizzle pgvector columns. */
export function vector<const TOptions extends VectorOptions = VectorOptions>(
	options: TOptions = {} as TOptions,
) {
	const defaults: Required<VectorDefaults> = {
		limit: options.defaults?.limit ?? 10,
		metric: options.defaults?.metric ?? 'cosine',
	}
	const validation = {
		dimensions: options.validation?.dimensions ?? true,
		finite: options.validation?.finite ?? true,
	}
	const names: Required<VectorMethodNames> = {
		nearest: options.methods?.nearest ?? 'nearest',
		similarTo: options.methods?.similarTo ?? 'similarTo',
		withinDistance: options.methods?.withinDistance ?? 'withinDistance',
	}

	return defineExtension({
		name: 'vector',
		lifecycle: {
			async info(database): Promise<VectorExtensionInfo> {
				const result = await database.execute(
					sql`select extversion from pg_extension where extname = 'vector'`,
				)
				const rows =
					result && typeof result === 'object' && 'rows' in result
						? (result.rows as readonly unknown[])
						: []
				const first = rows[0] as { extversion?: unknown } | undefined
				const version =
					typeof first?.extversion === 'string' ? first.extversion : undefined
				return {
					capabilities: capabilities(version),
					installed: version !== undefined,
					...(version === undefined ? {} : { version }),
				}
			},
		},
		postgres: { extension: 'vector', version: options.minVersion ?? '>=0.8.0' },
		table: {
			[names.nearest]: defineTableMethod<'anyVector', VectorMethodsTemplate>({
				columns: type('anyVector'),
				execute: (context, queryOptions) =>
					nearest(
						context,
						queryOptions as RuntimeNearestOptions,
						defaults,
						validation,
					),
			}),
			[names.similarTo]: defineTableMethod<'anyVector', VectorMethodsTemplate>({
				columns: type('anyVector'),
				execute: (context, queryOptions) => {
					const options = queryOptions as SimilarToOptions<AnyPgTable>
					const column = getColumn(context.table, options.by)
					const predicates = Object.entries(options.record).map(
						([name, value]) => {
							const recordColumn = getTableColumns(context.table)[name]
							if (!recordColumn)
								throw new TypeError(`Unknown record column "${name}".`)
							return eq(recordColumn, value)
						},
					)
					if (predicates.length === 0)
						throw new TypeError(
							'similarTo() requires at least one record field.',
						)

					const database = context.db as ExtensionTableContext['db'] &
						RuntimeDatabase
					const source = database
						.select({ vector: column })
						.from(context.table)
						.where(and(...predicates))
						.limit(1)

					return nearest(
						context,
						{
							vector: sql`(${source})`,
							...(options.by === undefined ? {} : { by: options.by }),
							...(options.limit === undefined ? {} : { limit: options.limit }),
							...(options.metric === undefined
								? {}
								: { metric: options.metric }),
							...(options.offset === undefined
								? {}
								: { offset: options.offset }),
							...(options.where === undefined ? {} : { where: options.where }),
						},
						defaults,
						validation,
						not(and(...predicates) as SQL),
					)
				},
			}),
			[names.withinDistance]: defineTableMethod<
				'anyVector',
				VectorMethodsTemplate
			>({
				columns: type('anyVector'),
				execute: (context, queryOptions) =>
					nearest(
						context,
						queryOptions as RuntimeNearestOptions,
						defaults,
						validation,
					),
			}),
		},
	})
}

export {
	add,
	avgVector,
	binaryQuantize,
	concat,
	cosineDistance,
	cosineSimilarity,
	dimensions,
	hammingDistance,
	innerProduct,
	jaccardDistance,
	l1Distance,
	l2Distance,
	multiply,
	negativeInnerProduct,
	norm,
	normalize,
	subtract,
	subvector,
	sumVector,
} from '../../shared/vector'
