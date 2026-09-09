import type {
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

/** Declares the PostgreSQL extension backing a Drizzle extension. */
export interface PostgresExtensionConfig {
	/** PostgreSQL's installed extension identifier, such as `pg_trgm`. */
	readonly extension: string
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
	 * Synchronously creates methods for each relational table in the schema.
	 * Returned methods may themselves be asynchronous.
	 */
	readonly table?: (context: ExtensionTableContext) => TMethods
	/**
	 * Readonly string `'extension'`.
	 */
	readonly type: 'extension'
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

/** Metadata and migration SQL for extensions configured on a client. */
export interface ExtensionsMetadata<TExtensions extends readonly Extension[]> {
	/** Public extension names in the same order they were configured. */
	readonly names: readonly ExtensionNames<TExtensions>[]
	/** Generates PostgreSQL statements that install every configured extension. */
	generate(): string
}

type ExtensionMethodsOf<TExtension extends Extension> = TExtension extends {
	readonly table: (...args: never[]) => infer TMethods
}
	? TMethods
	: object

type ExtensionMethodsOfAll<TExtensions extends readonly Extension[]> =
	TExtensions extends readonly [
		infer TExtension extends Extension,
		...infer TRest extends readonly Extension[],
	]
		? ExtensionMethodsOf<TExtension> & ExtensionMethodsOfAll<TRest>
		: object

type ExtendedQuery<
	TDatabase extends AnyPgDatabase,
	TExtensions extends readonly Extension[],
> =
	TDatabase['query'] extends Record<PropertyKey, unknown>
		? {
				[K in keyof TDatabase['query']]: TDatabase['query'][K] &
					ExtensionMethodsOfAll<TExtensions>
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

export type RuntimeQuery = Record<string, ExtensionTableMethods>
