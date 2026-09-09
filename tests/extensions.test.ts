import { expect, test } from 'bun:test'

import { $extends, defineExtension, type Extension } from '../src/index'
import { auditable, createDatabase, searchable } from './fixtures'

test('exposes configured extension names without mutating the base client', () => {
	const base = createDatabase()
	const database = $extends(base, { extensions: [searchable, auditable] })

	expect('$extensions' in base).toBe(false)
	expect(database.$extensions.names).toEqual(['searchable', 'auditable'])
	expect(Object.isFrozen(database.$extensions.names)).toBe(true)
	expect(Object.isFrozen(database.$extensions)).toBe(true)
})

test('generates installation SQL from PostgreSQL extension identifiers', () => {
	const database = $extends(createDatabase(), {
		extensions: [searchable, auditable],
	})

	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\nCREATE EXTENSION IF NOT EXISTS "audit";',
	)
})

test('deduplicates installation statements and escapes identifiers', () => {
	const quoted = defineExtension({
		name: 'quoted',
		postgres: { extension: 'quoted"extension', version: '>=1.0' },
	})
	const duplicate = defineExtension({
		name: 'duplicate',
		postgres: { extension: 'pg_trgm', version: '>=1.6' },
	})
	const database = $extends(createDatabase(), {
		extensions: [searchable, duplicate, quoted],
	})

	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\nCREATE EXTENSION IF NOT EXISTS "quoted""extension";',
	)
})

test('generates version checks when enforcing minimum extension versions', () => {
	const database = $extends(createDatabase(), { extensions: [searchable] })

	expect(database.$extensions.generate({ enforceMinimumVersion: true })).toBe(
		`DO $$
DECLARE
	installed_version text;
	available_version text;
BEGIN
	SELECT extversion INTO installed_version
	FROM pg_extension
	WHERE extname = 'pg_trgm';

	IF installed_version IS NULL THEN
		SELECT default_version INTO available_version
		FROM pg_available_extensions
		WHERE name = 'pg_trgm';
	END IF;

	IF COALESCE(installed_version, available_version) IS NULL
		OR string_to_array(COALESCE(installed_version, available_version), '.')::integer[]
			< string_to_array('1.6', '.')::integer[] THEN
		RAISE EXCEPTION USING MESSAGE = 'PostgreSQL extension "pg_trgm" requires version >=1.6.';
	END IF;

	CREATE EXTENSION IF NOT EXISTS "pg_trgm";
END
$$;`,
	)
})

test('enforces the greatest minimum version for duplicate extensions', () => {
	const lowerVersion = defineExtension({
		name: 'lower-version',
		postgres: { extension: 'pg_trgm', version: '>=1.0' },
	})
	const higherVersion = defineExtension({
		name: 'higher-version',
		postgres: { extension: 'pg_trgm', version: '>=1.6' },
	})
	const database = $extends(createDatabase(), {
		extensions: [lowerVersion, higherVersion],
	})
	const sql = database.$extensions.generate({ enforceMinimumVersion: true })

	expect(sql).toContain("string_to_array('1.6', '.')::integer[]")
	expect(sql).not.toContain("string_to_array('1.0', '.')::integer[]")
})

test('rejects malformed minimum versions when version checks are enforced', () => {
	const invalid = {
		name: 'invalid-version',
		postgres: { extension: 'invalid-version', version: '==1.6' },
	} as unknown as Extension
	const database = $extends(createDatabase(), { extensions: [invalid] })

	expect(() =>
		database.$extensions.generate({ enforceMinimumVersion: true }),
	).toThrow(
		'Extension versions must use a numeric minimum version such as ">=1.6"; received "==1.6".',
	)
})

test('escapes version-check error messages', () => {
	const extension = defineExtension({
		name: 'special-characters',
		postgres: { extension: "special%'extension", version: '>=1.0' },
	})
	const database = $extends(createDatabase(), { extensions: [extension] })

	expect(
		database.$extensions.generate({ enforceMinimumVersion: true }),
	).toContain(
		"RAISE EXCEPTION USING MESSAGE = 'PostgreSQL extension \"special%''extension\" requires version >=1.0.';",
	)
})

test('keeps version checks stable when extension metadata is mutated', () => {
	const extension = defineExtension({
		name: 'mutable',
		postgres: { extension: 'mutable', version: '>=1.0' },
	})
	const database = $extends(createDatabase(), { extensions: [extension] })
	const mutableExtension = extension as unknown as {
		postgres: { version: '>=1.0' | '>=2.0' }
	}

	mutableExtension.postgres.version = '>=2.0'

	expect(
		database.$extensions.generate({ enforceMinimumVersion: true }),
	).toContain("string_to_array('1.0', '.')::integer[]")
})

test('generates an empty SQL string when no extensions are configured', () => {
	const database = $extends(createDatabase(), { extensions: [] })

	expect(database.$extensions.names).toEqual([])
	expect(database.$extensions.generate()).toBe('')
})

test('keeps generated SQL stable when the caller mutates its extension array', () => {
	const extensions: Extension[] = [searchable]
	const database = $extends(createDatabase(), { extensions })

	extensions.push(auditable)

	expect(database.$extensions.names).toEqual(['searchable'])
	expect(database.$extensions.generate()).toBe(
		'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
	)
})
