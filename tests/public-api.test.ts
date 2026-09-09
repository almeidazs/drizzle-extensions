import { expect, test } from 'bun:test'

import packageJson from '../package.json'
import { $extends, defineExtension, version } from '../src/index'

test('exports the public extension API', () => {
	expect($extends).toBeFunction()
	expect(defineExtension).toBeFunction()
	expect(version).toBe(packageJson.version)
})
