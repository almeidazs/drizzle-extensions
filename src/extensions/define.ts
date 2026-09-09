import type { Extension, ExtensionDefinition } from '../types'

/**
 * Preserves an extension definition and its inferred table methods.
 *
 * The PostgreSQL metadata is declarative in this release; this function does
 * not issue database commands or install PostgreSQL extensions.
 */
export function defineExtension<const TExtension extends ExtensionDefinition>(
	definition: TExtension,
): TExtension & Pick<Extension, 'type'> {
	return {
		...definition,
		type: 'extension',
	}
}
