import { sql } from 'drizzle-orm'
import { type AnyPgColumn, index } from 'drizzle-orm/pg-core'

import type { AnyVectorMetric, VectorIndexOptions } from '../../types'

const operatorClasses = {
	PgBinaryVector: { hamming: 'bit_hamming_ops', jaccard: 'bit_jaccard_ops' },
	PgHalfVector: {
		cosine: 'halfvec_cosine_ops',
		innerProduct: 'halfvec_ip_ops',
		l1: 'halfvec_l1_ops',
		l2: 'halfvec_l2_ops',
	},
	PgSparseVector: {
		cosine: 'sparsevec_cosine_ops',
		innerProduct: 'sparsevec_ip_ops',
		l1: 'sparsevec_l1_ops',
		l2: 'sparsevec_l2_ops',
	},
	PgVector: {
		cosine: 'vector_cosine_ops',
		innerProduct: 'vector_ip_ops',
		l1: 'vector_l1_ops',
		l2: 'vector_l2_ops',
	},
} as const

function operatorClass(column: AnyPgColumn, metric: AnyVectorMetric): string {
	const classes = operatorClasses[
		column.columnType as keyof typeof operatorClasses
	] as Record<string, string> | undefined
	const value = classes?.[metric]
	if (!value)
		throw new TypeError(
			`Metric "${metric}" is not compatible with "${column.columnType}" indexes.`,
		)
	return value
}

/** Creates a pgvector approximate index with the correct operator class. */
export function vectorIndex<
	TColumn extends AnyPgColumn,
	TUsing extends 'hnsw' | 'ivfflat',
>(name: string, options: VectorIndexOptions<TColumn, TUsing>) {
	if (options.using === 'ivfflat' && options.metric === 'l1')
		throw new TypeError('IVFFlat does not support the l1 metric.')
	if (
		options.using === 'ivfflat' &&
		options.column.columnType === 'PgSparseVector'
	)
		throw new TypeError('IVFFlat does not support sparsevec columns.')

	const configuration = {
		...(options.using === 'hnsw' && options.efConstruction !== undefined
			? { ef_construction: options.efConstruction }
			: {}),
		...(options.using === 'ivfflat' && options.lists !== undefined
			? { lists: options.lists }
			: {}),
		...(options.using === 'hnsw' && options.m !== undefined
			? { m: options.m }
			: {}),
	}
	const expression = sql`${options.column} ${sql.raw(operatorClass(options.column, options.metric))}`
	return index(name).using(options.using, expression).with(configuration)
}

/** Creates an HNSW vector index. */
export function hnsw<TColumn extends AnyPgColumn>(
	name: string,
	options: Omit<VectorIndexOptions<TColumn, 'hnsw'>, 'using'>,
) {
	return vectorIndex(name, { ...options, using: 'hnsw' })
}

/** Creates an IVFFlat vector index. */
export function ivfflat<TColumn extends AnyPgColumn>(
	name: string,
	options: Omit<VectorIndexOptions<TColumn, 'ivfflat'>, 'using'>,
) {
	return vectorIndex(name, { ...options, using: 'ivfflat' })
}
