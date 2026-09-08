import { expect, test } from 'bun:test'

test('public entrypoint can be imported', async () => {
	await import('../src/index')

	expect(true).toBe(true)
})
