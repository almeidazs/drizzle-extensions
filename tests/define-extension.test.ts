import { expect, test } from 'bun:test'

import { defineExtension } from '../src/index'

test('normalizes a definition with its extension discriminant', () => {
	const extension = defineExtension({
		name: 'example',
		postgres: { extension: 'example' },
	})

	expect(extension).toEqual({
		name: 'example',
		postgres: { extension: 'example' },
		type: 'extension',
	})
})
