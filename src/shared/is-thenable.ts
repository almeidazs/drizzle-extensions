/** Returns whether a value implements the Promise-like `then` method. */
export function isThenable(value: unknown): value is PromiseLike<unknown> {
	if (typeof value !== 'object' && typeof value !== 'function') return false

	return value !== null && 'then' in value && typeof value.then === 'function'
}
