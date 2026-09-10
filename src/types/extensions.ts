import type {
	AnyPgColumn,
	AnyPgTable,
	PgDatabase,
	PgQueryResultHKT,
} from 'drizzle-orm/pg-core'

/** A PostgreSQL Drizzle client that can be extended with table methods. */
export type AnyPgDatabase = PgDatabase<
	PgQueryResultHKT,
	Record<string, unknown>
>

/** Methods added to a relational query builder by an extension. */
export type ExtensionTableMethods = Record<
	string,
	(...arguments_: never[]) => unknown
>

/** Column kinds supported by declarative table methods. */
export type ExtensionColumnType =
	| 'anyVector'
	| 'bit'
	| 'halfvec'
	| 'sparsevec'
	| 'vector'

type DrizzleColumnType<TType extends ExtensionColumnType> =
	TType extends 'anyVector'
		? 'PgBinaryVector' | 'PgHalfVector' | 'PgSparseVector' | 'PgVector'
		: TType extends 'bit'
			? 'PgBinaryVector'
			: TType extends 'halfvec'
				? 'PgHalfVector'
				: TType extends 'sparsevec'
					? 'PgSparseVector'
					: TType extends 'vector'
						? 'PgVector'
						: never

/** Describes the column kind required by a declarative table method. */
export interface ExtensionColumnRequirement<
	TType extends ExtensionColumnType = ExtensionColumnType,
> {
	/** Internal discriminant used to identify a column requirement at runtime. */
	readonly type: 'column-type'
	/** Public PostgreSQL column kind, such as `vector`. */
	readonly name: TType
	/** Drizzle runtime column types that satisfy this requirement. */
	readonly columnTypes: readonly DrizzleColumnType<TType>[]
}

/** Template whose methods are specialized for a database and table. */
export interface TableMethodsTemplate {
	/** Database type used to instantiate the template. */
	readonly database: AnyPgDatabase
	/** Table type used to instantiate the template. */
	readonly table: AnyPgTable
	/** Methods produced after the template is instantiated. */
	readonly methods: object
}

/** Context supplied when an extension is applied to a schema table. */
export interface ExtensionTableContext<
	TDatabase extends AnyPgDatabase = AnyPgDatabase,
	TTable extends AnyPgTable = AnyPgTable,
> {
	/** The extended Drizzle client receiving the extension methods. */
	readonly db: TDatabase
	/** The original PostgreSQL table definition from the supplied schema. */
	readonly table: TTable
}

/** Declarative definition of one method added to eligible tables. */
export interface TableMethodDefinition<TType extends ExtensionColumnType> {
	/** Column requirement that determines whether this method applies to a table. */
	readonly columns: ExtensionColumnRequirement<TType>
	/** Synchronously executes the method with its extension context and arguments. */
	readonly execute: (
		context: ExtensionTableContext,
		...arguments_: never[]
	) => unknown
}

/** A normalized declarative method added to eligible relational query builders. */
export interface TableMethod<
	TType extends ExtensionColumnType = ExtensionColumnType,
	TTemplate extends TableMethodsTemplate = TableMethodsTemplate,
> extends TableMethodDefinition<TType> {
	/** Internal discriminant used to identify a table method at runtime. */
	readonly type: 'table-method'
	/** Type-only template used to specialize the method for an eligible table. */
	readonly template?: TTemplate
}

/** Map of declarative methods supplied by an extension. */
export type TableMethodDefinitions = Record<
	string,
	TableMethod<ExtensionColumnType, TableMethodsTemplate>
>

/** Declares the PostgreSQL extension backing a Drizzle extension. */
export interface PostgresExtensionConfig {
	/** PostgreSQL's installed extension identifier, such as `pg_trgm`. */
	readonly extension: string
	/** Minimum supported version of the PostgreSQL extension. */
	readonly version: `>=${string}`
}

/** Defines the behavior an extension contributes to relational tables. */
export interface Extension<
	TMethods extends ExtensionTableMethods = ExtensionTableMethods,
> {
	/** Stable identifier for this extension. */
	readonly name: string
	/** Declarative metadata for the required PostgreSQL extension. */
	readonly postgres: PostgresExtensionConfig
	/**
	 * Extensions that must be configured alongside this extension.
	 * Strings are extension names; extension definitions use their name.
	 */
	readonly requires?: readonly (string | Extension)[]
	/** Optional runtime metadata exposed under `$extensions.<extensionName>`. */
	readonly lifecycle?: ExtensionLifecycle
	/**
	 * Synchronously creates methods for each relational table in the schema.
	 * Returned methods may themselves be asynchronous.
	 */
	readonly table?:
		| ((context: ExtensionTableContext) => TMethods)
		| TableMethodDefinitions
	/**
	 * Readonly string `'extension'`.
	 */
	readonly type: 'extension'
}

/** Runtime operations optionally contributed by an extension. */
export interface ExtensionLifecycle {
	/** Reads installation and capability information from the current database. */
	info(database: AnyPgDatabase): Promise<unknown>
}

/** Input accepted by {@link defineExtension} before it is normalized. */
export type ExtensionDefinition<
	TMethods extends ExtensionTableMethods = ExtensionTableMethods,
> = Omit<Extension<TMethods>, 'type'>

/** Configuration accepted by {@link $extends}. */
export interface ExtendsOptions<TExtensions extends readonly Extension[]> {
	/** Ordered extensions whose table methods will be composed into the client. */
	readonly extensions: TExtensions
}

type ExtensionNames<TExtensions extends readonly Extension[]> =
	TExtensions[number]['name'] & string

/** Options for generating PostgreSQL extension installation SQL. */
export interface GenerateExtensionsOptions {
	/** Verify the installed or available extension version before installing it. */
	readonly enforceMinimumVersion?: boolean
}

/** Metadata and migration SQL for extensions configured on a client. */
type ExtensionLifecycleMetadata<TExtension extends Extension> =
	TExtension extends {
		readonly lifecycle: infer TLifecycle extends ExtensionLifecycle
	}
		? {
				readonly [TName in TExtension['name']]: {
					/** Reads runtime metadata using the extended database client. */
					info(): ReturnType<TLifecycle['info']>
				}
			}
		: object

type ExtensionsLifecycleMetadata<TExtensions extends readonly Extension[]> =
	UnionToIntersection<ExtensionLifecycleMetadata<TExtensions[number]>>

/** Metadata and runtime operations for extensions configured on a client. */
export type ExtensionsMetadata<TExtensions extends readonly Extension[]> = {
	/** Public extension names in the same order they were configured. */
	readonly names: readonly ExtensionNames<TExtensions>[]
	/** Generates PostgreSQL statements that install every configured extension. */
	generate(options?: GenerateExtensionsOptions): string
} & ExtensionsLifecycleMetadata<TExtensions>

type TableHasColumnType<
	TTable extends AnyPgTable,
	TType extends ExtensionColumnType,
> = {
	[K in keyof TTable['_']['columns']]: TTable['_']['columns'][K] extends AnyPgColumn<{
		columnType: DrizzleColumnType<TType>
	}>
		? true
		: never
}[keyof TTable['_']['columns']] extends never
	? false
	: true

type InstantiateTableMethods<
	TTemplate extends TableMethodsTemplate,
	TDatabase extends AnyPgDatabase,
	TTable extends AnyPgTable,
> = (TTemplate & {
	readonly database: TDatabase
	readonly table: TTable
})['methods']

type TableMethodMethodsOf<
	TMethod extends TableMethod,
	TDatabase extends AnyPgDatabase,
	TTable extends AnyPgTable,
> =
	TMethod extends TableMethod<infer TType, infer TTemplate>
		? TableHasColumnType<TTable, TType> extends true
			? InstantiateTableMethods<TTemplate, TDatabase, TTable>
			: object
		: object

type DeclarativeTableMethodsOf<
	TMethods extends TableMethodDefinitions,
	TDatabase extends AnyPgDatabase,
	TTable extends AnyPgTable,
> = {
	[K in keyof TMethods]: TableMethodMethodsOf<TMethods[K], TDatabase, TTable>
}[keyof TMethods]

type UnionToIntersection<TValue> = (
	TValue extends unknown
		? (value: TValue) => void
		: never
) extends (value: infer TIntersection) => void
	? TIntersection
	: never

type ExtensionMethodsOf<
	TExtension extends Extension,
	TDatabase extends AnyPgDatabase,
	TTable extends AnyPgTable,
> = TExtension extends {
	readonly table: (...arguments_: never[]) => infer TMethods
}
	? TMethods
	: TExtension extends { readonly table: infer TMethods }
		? TMethods extends TableMethodDefinitions
			? UnionToIntersection<
					DeclarativeTableMethodsOf<TMethods, TDatabase, TTable>
				>
			: object
		: object

type ExtensionMethodsOfAll<
	TExtensions extends readonly Extension[],
	TDatabase extends AnyPgDatabase,
	TTable extends AnyPgTable,
> = TExtensions extends readonly [
	infer TExtension extends Extension,
	...infer TRest extends readonly Extension[],
]
	? ExtensionMethodsOf<TExtension, TDatabase, TTable> &
			ExtensionMethodsOfAll<TRest, TDatabase, TTable>
	: object

type ExtendedQuery<
	TDatabase extends AnyPgDatabase,
	TExtensions extends readonly Extension[],
> =
	TDatabase['query'] extends Record<PropertyKey, unknown>
		? {
				[K in keyof TDatabase['query']]: TDatabase['query'][K] &
					ExtensionMethodsOfAll<
						TExtensions,
						TDatabase,
						TDatabase['_']['fullSchema'][K &
							keyof TDatabase['_']['fullSchema']] extends AnyPgTable
							? TDatabase['_']['fullSchema'][K &
									keyof TDatabase['_']['fullSchema']]
							: AnyPgTable
					>
			}
		: TDatabase['query']

/** A PostgreSQL Drizzle client with methods contributed to every query table. */
export type ExtendedDatabase<
	TDatabase extends AnyPgDatabase,
	TExtensions extends readonly Extension[],
> = Omit<TDatabase, 'query'> & {
	/** Relational query builders enriched with the configured extension methods. */
	query: ExtendedQuery<TDatabase, TExtensions>
	/** Configured extensions and their generated PostgreSQL installation SQL. */
	$extensions: ExtensionsMetadata<TExtensions>
}

/** Internal runtime representation of relational query builders. */
export type RuntimeQuery = Record<string, ExtensionTableMethods>
