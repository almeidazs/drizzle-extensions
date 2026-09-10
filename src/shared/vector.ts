import { isSQLWrapper, type SQL, type SQLWrapper, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import type { AnyVectorMetric, SparseVectorInput } from '../types/vector'

type VectorExpression = AnyPgColumn | SQLWrapper

const operators: Record<
	AnyVectorMetric,
	'<#>' | '<%>' | '<+>' | '<->' | '<=>' | '<~>'
> = {
	cosine: '<=>',
	hamming: '<~>',
	innerProduct: '<#>',
	jaccard: '<%>',
	l1: '<+>',
	l2: '<->',
}

/** Serializes a sparse input to pgvector's canonical literal syntax. */
export function serializeSparseVector(input: SparseVectorInput): string {
	const entries = Object.entries(input.values)
		.map(([index, value]) => [Number(index), value] as const)
		.sort(([first], [second]) => first - second)
		.map(([index, value]) => `${index}:${value}`)
		.join(',')

	return `{${entries}}/${input.dimensions}`
}

/** Creates a bound pgvector value from a native JavaScript input. */
export function vectorValue(
	value: readonly number[] | SparseVectorInput | SQL | string,
	column: AnyPgColumn,
): SQL {
	if (
		typeof value === 'object' &&
		!Array.isArray(value) &&
		!('queryChunks' in value)
	)
		return sql`${sql.param(serializeSparseVector(value as SparseVectorInput), column)}`

	return isSQLWrapper(value) ? sql`${value}` : sql`${sql.param(value, column)}`
}

/** Builds a pgvector distance expression. */
export function vectorDistance(
	metric: AnyVectorMetric,
	left: VectorExpression,
	right: VectorExpression,
): SQL<number> {
	return sql<number>`${left} ${sql.raw(operators[metric])} ${right}`
}

/** Returns the L2 distance between two vector expressions. */
export const l2Distance = (left: VectorExpression, right: VectorExpression) =>
	vectorDistance('l2', left, right)
/** Returns the L1 distance between two vector expressions. */
export const l1Distance = (left: VectorExpression, right: VectorExpression) =>
	vectorDistance('l1', left, right)
/** Returns the cosine distance between two vector expressions. */
export const cosineDistance = (
	left: VectorExpression,
	right: VectorExpression,
) => vectorDistance('cosine', left, right)
/** Returns cosine similarity between two vector expressions. */
export const cosineSimilarity = (
	left: VectorExpression,
	right: VectorExpression,
) => sql<number>`1 - ${cosineDistance(left, right)}`
/** Returns pgvector's negative inner-product operator value. */
export const negativeInnerProduct = (
	left: VectorExpression,
	right: VectorExpression,
) => vectorDistance('innerProduct', left, right)
/** Returns the semantic positive inner product. */
export const innerProduct = (left: VectorExpression, right: VectorExpression) =>
	sql<number>`${negativeInnerProduct(left, right)} * -1`
/** Returns Hamming distance between binary-vector expressions. */
export const hammingDistance = (
	left: VectorExpression,
	right: VectorExpression,
) => vectorDistance('hamming', left, right)
/** Returns Jaccard distance between binary-vector expressions. */
export const jaccardDistance = (
	left: VectorExpression,
	right: VectorExpression,
) => vectorDistance('jaccard', left, right)
/** Adds two dense-vector expressions. */
export const add = (left: VectorExpression, right: VectorExpression) =>
	sql`${left} + ${right}`
/** Subtracts two dense-vector expressions. */
export const subtract = (left: VectorExpression, right: VectorExpression) =>
	sql`${left} - ${right}`
/** Multiplies two dense-vector expressions element-wise. */
export const multiply = (left: VectorExpression, right: VectorExpression) =>
	sql`${left} * ${right}`
/** Concatenates two dense-vector expressions. */
export const concat = (left: VectorExpression, right: VectorExpression) =>
	sql`${left} || ${right}`
/** Normalizes a vector expression by its L2 norm. */
export const normalize = (value: VectorExpression) =>
	sql`l2_normalize(${value})`
/** Returns the L2 norm of a vector expression. */
export const norm = (value: VectorExpression) =>
	sql<number>`vector_norm(${value})`
/** Returns the dimensions of a vector expression. */
export const dimensions = (value: VectorExpression) =>
	sql<number>`vector_dims(${value})`
/** Extracts a contiguous subvector. */
export const subvector = (
	value: VectorExpression,
	options: { dimensions: number; start: number },
) => sql`subvector(${value}, ${options.start}, ${options.dimensions})`
/** Converts a dense vector expression to a binary vector. */
export const binaryQuantize = (value: VectorExpression) =>
	sql<string>`binary_quantize(${value})`
/** Returns the average of a vector expression. */
export const avgVector = (value: VectorExpression) => sql`avg(${value})`
/** Returns the sum of a vector expression. */
export const sumVector = (value: VectorExpression) => sql`sum(${value})`
