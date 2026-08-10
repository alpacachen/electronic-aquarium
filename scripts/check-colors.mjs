import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const colorTokens = (source) =>
  new Map(
    [...source.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map(
      ([, name, value]) => [name, value.toLowerCase()],
    ),
  )

const theme = colorTokens(read('src/styles.css'))
const errors = []
const html = read('index.html')
const inline = colorTokens(html)

for (const [name, value] of inline) {
  if (theme.get(name) !== value) errors.push(`index.html: --color-${name} is ${value}`)
}

for (const [, name] of html.matchAll(/var\(--color-([\w-]+)\)/g)) {
  if (!inline.has(name)) errors.push(`index.html: --color-${name} is missing`)
}

for (const [, name, value] of read('src/aquarium/palette.ts').matchAll(
  /\b([A-Z_]+):\s*'(#[\da-f]{6})'/g,
)) {
  const token = name.toLowerCase().replaceAll('_', '-')
  if (theme.get(token) !== value.toLowerCase()) errors.push(`palette.ts: ${name} is ${value}`)
}

const themeColor = /<meta name="theme-color" content="(#[\da-f]{6})"/i.exec(html)?.[1]
if (themeColor?.toLowerCase() !== theme.get('abyss')) {
  errors.push(`index.html: theme-color is ${themeColor ?? 'missing'}`)
}

const allowed = new Set(theme.values())
const files = ['index.html']
const visit = (directory) => {
  for (const entry of readdirSync(new URL(directory, root), { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) visit(`${path}/`)
    else if (['.css', '.ts', '.tsx'].includes(extname(entry.name))) files.push(path)
  }
}
visit('src/')

for (const file of files) {
  for (const match of read(file).matchAll(/#[\da-f]{6}\b/gi)) {
    if (!allowed.has(match[0].toLowerCase())) errors.push(`${file}: unregistered ${match[0]}`)
  }
}

if (errors.length > 0) {
  console.error(`Color tokens are out of sync:\n${errors.map((error) => `- ${error}`).join('\n')}`)
  process.exitCode = 1
}
