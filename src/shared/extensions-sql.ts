import type { Extension, GenerateExtensionsOptions } from '../types/extensions'

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`
}

function quoteLiteral(value: string): string {
	return `'${value.replaceAll("'", "''")}'`
}

function getMinimumVersion(version: string): string {
	const match = /^>=(\d+(?:\.\d+)*)$/.exec(version)
	const minimumVersion = match?.[1]

	if (minimumVersion) return minimumVersion

	throw new TypeError(
		`Extension versions must use a numeric minimum version such as ">=1.6"; received "${version}".`,
	)
}

function compareMinimumVersions(first: string, second: string): number {
	const firstParts = getMinimumVersion(first).split('.').map(Number)
	const secondParts = getMinimumVersion(second).split('.').map(Number)
	const length = Math.max(firstParts.length, secondParts.length)

	for (let index = 0; index < length; index++) {
		const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0)

		if (difference !== 0) return difference
	}

	return 0
}

function getVersionCheckedExtensions(
	extensions: readonly Extension[],
): Extension[] {
	return extensions.reduce<Extension[]>((uniqueExtensions, extension) => {
		const existingIndex = uniqueExtensions.findIndex(
			({ postgres }) => postgres.extension === extension.postgres.extension,
		)

		if (existingIndex === -1) {
			getMinimumVersion(extension.postgres.version)
			uniqueExtensions.push(extension)
			return uniqueExtensions
		}

		const existingExtension = uniqueExtensions[existingIndex]
		if (!existingExtension) return uniqueExtensions

		if (
			compareMinimumVersions(
				extension.postgres.version,
				existingExtension.postgres.version,
			) > 0
		)
			uniqueExtensions[existingIndex] = extension

		return uniqueExtensions
	}, [])
}

function generateVersionCheckedSql(extension: Extension): string {
	const extensionName = extension.postgres.extension
	const minimumVersion = getMinimumVersion(extension.postgres.version)
	const installedOrAvailableVersion =
		'COALESCE(installed_version, available_version)'

	return `DO $$
DECLARE
	installed_version text;
	available_version text;
BEGIN
	SELECT extversion INTO installed_version
	FROM pg_extension
	WHERE extname = ${quoteLiteral(extensionName)};

	IF installed_version IS NULL THEN
		SELECT default_version INTO available_version
		FROM pg_available_extensions
		WHERE name = ${quoteLiteral(extensionName)};
	END IF;

	IF ${installedOrAvailableVersion} IS NULL
		OR string_to_array(${installedOrAvailableVersion}, '.')::integer[]
			< string_to_array(${quoteLiteral(minimumVersion)}, '.')::integer[] THEN
		RAISE EXCEPTION USING MESSAGE = ${quoteLiteral(
			`PostgreSQL extension "${extensionName}" requires version ${extension.postgres.version}.`,
		)};
	END IF;

	CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(extensionName)};
END
$$;`
}

/** Generates PostgreSQL statements that install the supplied extensions. */
export function generateExtensionsSql(
	extensions: readonly Extension[],
	options: GenerateExtensionsOptions = {},
): string {
	if (options.enforceMinimumVersion) {
		return getVersionCheckedExtensions(extensions)
			.map(generateVersionCheckedSql)
			.join('\n')
	}

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
