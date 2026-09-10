import { vector } from '../src/extensions/vector'
import { $extends } from '../src/index'
import { createVectorDatabase } from './fixtures'

function expectType<TValue>(_value: TValue): void {}

const database = $extends(createVectorDatabase([]), { extensions: [vector()] })

const nearest = database.query.documents.nearest({
	include: { similarity: true },
	select: { id: true, title: true },
	vector: [0.1, 0.2, 0.3],
})
expectType<Promise<{ id: number; similarity: number; title: string }[]>>(
	nearest,
)

const withDistance = database.query.documents.nearest({
	include: { distance: true },
	metric: 'l2',
	select: { id: true },
	vector: [0.1, 0.2, 0.3],
})
expectType<Promise<{ distance: number; id: number }[]>>(withDistance)

if (process.env.NODE_ENV === 'type-test') {
	// @ts-expect-error tables without native pgvector columns do not expose methods
	database.query.users.nearest

	database.query.documents.nearest({
		// @ts-expect-error column names are restricted to native pgvector columns
		by: 'title',
		vector: [0.1, 0.2, 0.3],
	})

	database.query.documents.nearest({
		// @ts-expect-error unsupported pgvector metrics are rejected
		metric: 'hamming',
		vector: [0.1, 0.2, 0.3],
	})

	database.query.documents.nearest({
		metric: 'l2',
		// @ts-expect-error cosine similarity is only available for cosine queries
		include: { similarity: true },
		vector: [0.1, 0.2, 0.3],
	})
}
