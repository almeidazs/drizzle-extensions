import type { SQL } from 'drizzle-orm'
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core'

/** Distance metrics for dense pgvector column types. */
export type VectorMetric = 'cosine' | 'innerProduct' | 'l1' | 'l2'

/** Distance metrics for pgvector binary columns. */
export type BitMetric = 'hamming' | 'jaccard'

/** Every pgvector distance metric supported by this package. */
export type AnyVectorMetric = BitMetric | VectorMetric

/** Supported approximate pgvector index methods. */
export type VectorIndex = 'hnsw' | 'ivfflat'

/** Index construction options shared by pgvector approximate index helpers. */
export interface VectorIndexOptions<
	TColumn extends AnyPgColumn = AnyPgColumn,
	TUsing extends VectorIndex = VectorIndex,
> {
	/** Native Drizzle pgvector column indexed by PostgreSQL. */
	readonly column: TColumn
	/** Index method selected for the vector column. */
	readonly using: TUsing
	/** Distance metric represented by the generated operator class. */
	readonly metric: CompatibleVectorMetric<TColumn>
	/** HNSW graph-neighbor count. Valid only with `using: 'hnsw'`. */
	readonly m?: TUsing extends 'hnsw' ? number : never
	/** HNSW construction search width. Valid only with `using: 'hnsw'`. */
	readonly efConstruction?: TUsing extends 'hnsw' ? number : never
	/** IVFFlat list count. Valid only with `using: 'ivfflat'`. */
	readonly lists?: TUsing extends 'ivfflat' ? number : never
}

/** Sparse-vector input normalized to pgvector's one-indexed representation. */
export interface SparseVectorInput {
	/** Total dimensions in the sparse vector. */
	readonly dimensions: number
	/** Non-zero values keyed by their one-indexed vector position. */
	readonly values: Readonly<Record<number, number>>
}

/** A native Drizzle column from one of pgvector's four supported families. */
export type AnyVectorColumn<TTable extends AnyPgTable> = {
	[K in keyof TTable]: TTable[K] extends {
		readonly columnType:
			| 'PgBinaryVector'
			| 'PgHalfVector'
			| 'PgSparseVector'
			| 'PgVector'
	}
		? TTable[K]
		: never
}[keyof TTable]

/** Autocomplete-enabled keys of pgvector columns in a table. */
export type VectorColumnName<TTable extends AnyPgTable> = {
	[K in keyof TTable]: TTable[K] extends AnyVectorColumn<TTable> ? K : never
}[keyof TTable] &
	string

/** Resolves a pgvector table key to its Drizzle column type. */
export type VectorColumnByName<
	TTable extends AnyPgTable,
	TName extends VectorColumnName<TTable>,
> = TTable[TName] extends AnyVectorColumn<TTable> ? TTable[TName] : never

/** Metrics valid for an individual native pgvector column. */
export type CompatibleVectorMetric<TColumn> = TColumn extends
	| AnyPgColumn<{
			columnType: 'PgBinaryVector'
	  }>
	| { readonly columnType: 'PgBinaryVector' }
	? BitMetric
	: TColumn extends {
				readonly columnType: 'PgHalfVector' | 'PgSparseVector' | 'PgVector'
			}
		? VectorMetric
		: never

/** Input values valid for an individual native pgvector column. */
export type VectorInput<TColumn> = TColumn extends
	| AnyPgColumn<{
			columnType: 'PgBinaryVector'
	  }>
	| { readonly columnType: 'PgBinaryVector' }
	? SQL | string
	: TColumn extends { readonly columnType: 'PgSparseVector' }
		? SQL | SparseVectorInput
		: TColumn extends { readonly columnType: 'PgHalfVector' | 'PgVector' }
			? SQL | readonly number[]
			: never

/** Defaults shared by all vector table methods. */
export interface VectorDefaults {
	/** Default distance metric when a query omits `metric`. */
	readonly metric?: AnyVectorMetric
	/** Default maximum number of rows returned by a query. */
	readonly limit?: number
}

/** Runtime validation performed for JavaScript values passed to vector queries. */
export interface VectorValidationOptions {
	/** Validates dimensions against the selected native Drizzle column. */
	readonly dimensions?: boolean
	/** Rejects non-finite dense and sparse numeric values. */
	readonly finite?: boolean
}

/** Optional names for vector methods added to an eligible table. */
export interface VectorMethodNames {
	/** Name exposed for nearest-neighbor search. */
	readonly nearest?: string
	/** Name exposed for record-relative nearest-neighbor search. */
	readonly similarTo?: string
	/** Name exposed for explicit radius search. */
	readonly withinDistance?: string
}

/** Capabilities detected from the installed pgvector version. */
export interface VectorCapabilities {
	/** Whether HNSW indexes are available. */
	readonly hnsw: boolean
	/** Whether IVFFlat indexes are available. */
	readonly ivfflat: boolean
	/** Whether half-precision vectors are available. */
	readonly halfvec: boolean
	/** Whether sparse vectors are available. */
	readonly sparsevec: boolean
	/** Whether binary quantization is available. */
	readonly binaryQuantization: boolean
	/** Whether iterative approximate scans are available. */
	readonly iterativeScan: boolean
}

/** Runtime information returned by `db.$extensions.vector.info()`. */
export interface VectorExtensionInfo {
	/** Whether pgvector is installed in the current database. */
	readonly installed: boolean
	/** Installed pgvector version when available. */
	readonly version?: string
	/** Features supported by the detected pgvector version. */
	readonly capabilities: VectorCapabilities
}

/** Configuration accepted by {@link vector}. */
export interface VectorOptions {
	/** Defaults shared by every table method. */
	readonly defaults?: VectorDefaults
	/** Minimum pgvector version required by this extension. */
	readonly minVersion?: `>=${string}`
	/** Optional table-method renames. */
	readonly methods?: VectorMethodNames
	/** Validation applied to JavaScript vector inputs. */
	readonly validation?: VectorValidationOptions
}

/** Boolean selection map over a table's columns. */
export type VectorSelect<TTable extends AnyPgTable> = Partial<
	Record<keyof TTable & string, true>
>

/** Adds optional computed distance and similarity fields to a query result. */
export interface VectorInclude {
	/** Adds the pgvector distance used for ranking. */
	readonly distance?: boolean
	/** Adds cosine similarity, valid only for cosine ranking. */
	readonly similarity?: boolean
}

type ColumnData<TColumn> =
	TColumn extends AnyPgColumn<infer TConfig> ? TConfig['data'] : never

type TableResult<TTable extends AnyPgTable> = {
	[K in keyof TTable]: ColumnData<TTable[K]>
}

type SelectedTableResult<
	TTable extends AnyPgTable,
	TSelect extends VectorSelect<TTable> | undefined,
> =
	TSelect extends VectorSelect<TTable>
		? Pick<TableResult<TTable>, keyof TSelect & keyof TableResult<TTable>>
		: TableResult<TTable>

/** Result shape for a vector query and its requested computed fields. */
export type VectorQueryResult<
	TTable extends AnyPgTable,
	TSelect extends VectorSelect<TTable> | undefined,
	TInclude extends VectorInclude | undefined,
> = SelectedTableResult<TTable, TSelect> &
	(TInclude extends { readonly distance: true }
		? { distance: number }
		: object) &
	(TInclude extends { readonly similarity: true }
		? { similarity: number }
		: object)
