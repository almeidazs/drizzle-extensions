import { readFile, writeFile } from 'node:fs/promises'

const { version } = JSON.parse(
	await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

await writeFile(
	new URL('../src/version.ts', import.meta.url),
	`/** Current package version. */\nexport const version = '${version}'\n`,
)
