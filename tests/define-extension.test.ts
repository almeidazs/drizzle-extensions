import { expect, test } from 'bun:test'

import { defineExtension } from '../src/index'

test('normalizes a definition with its extension discriminant', () => {
	const dependency = defineExtension({
		name: 'dependency',
		postgres: { extension: 'dependency', version: '>=1.0' },
	})
	const extension = defineExtension({
		name: 'example',
		postgres: { extension: 'example', version: '>=1.6' },
		requires: ['string-dependency', dependency],
	})

	expect(extension).toEqual({
		name: 'example',
		postgres: { extension: 'example', version: '>=1.6' },
		requires: ['string-dependency', dependency],
		type: 'extension',
	})
})
