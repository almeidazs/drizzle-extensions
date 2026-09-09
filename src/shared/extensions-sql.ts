import type { Extension } from '../types/extensions'

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`
}

/** Generates PostgreSQL statements that install the supplied extensions. */
export function generateExtensionsSql(
	extensions: readonly Extension[],
): string {
	const extensionNames = new Set(
		extensions.map((extension) => extension.postgres.extension),
	)

	return [...extensionNames]
		.map(
			(extensionName) =>
				`CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(extensionName)};`,
		)
		.join('\n')
}
