import { expect, test } from 'bun:test'

import packageJson from '../package.json'

import { version } from '../src/index'

test('public entrypoint can be imported', async () => {
	await import('../src/index')

	expect(version).toBe(packageJson.version)
})
