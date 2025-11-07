import { resolve as rawResolve } from 'node:path'
import process from 'node:process'
import { beforeEach, expect, test } from 'vitest'
import { createFilter, normalizePath } from '../src'

const resolve = (...parts: string[]) => normalizePath(rawResolve(...parts))

beforeEach(() => process.chdir(__dirname))

test('includes by default', () => {
  const filter = createFilter()
  expect(filter(resolve('x'))).toBe(true)
})

test('excludes IDs that are not included, if include.length > 0', () => {
  const filter = createFilter(['y'])
  expect(filter(resolve('x'))).toBe(false)
  expect(filter(resolve('y'))).toBe(true)
})

test('excludes IDs explicitly', () => {
  const filter = createFilter(null, ['y'])
  expect(filter(resolve('x'))).toBe(true)
  expect(filter(resolve('y'))).toBe(false)
})

test('handles non-array arguments', () => {
  const filter = createFilter('foo/*', 'foo/baz')
  expect(filter(resolve('foo/bar'))).toBe(true)
  expect(filter(resolve('foo/baz'))).toBe(false)
})

test('negation patterns', () => {
  const filter = createFilter(['a/!(b)/c'])
  expect(filter(resolve('a/d/c'))).toBe(true)
  expect(filter(resolve('a/b/c'))).toBe(false)
})

test('excludes non-string IDs', () => {
  const filter = createFilter(null, null)
  expect(filter({})).toBe(false)
})

test('excludes strings beginning with NUL', () => {
  const filter = createFilter(null, null)
  expect(filter('\0someid')).toBe(false)
})

test('includes with regexp', () => {
  const filter = createFilter(['a/!(b)/c', /\.js$/])
  expect(filter(resolve('a/d/c'))).toBe(true)
  expect(filter(resolve('a/b/c'))).toBe(false)
  expect(filter(resolve('a.js'))).toBe(true)
  expect(filter(resolve('a/b.js'))).toBe(true)
  expect(filter(resolve('a/b.jsx'))).toBe(false)
})

test('excludes with regexp', () => {
  const filter = createFilter(['a/!(b)/c', /\.js$/], /\.js$/)
  expect(filter(resolve('a/d/c'))).toBe(true)
  expect(filter(resolve('a/b/c'))).toBe(false)
  expect(filter(resolve('a.js'))).toBe(false)
  expect(filter(resolve('a/b.js'))).toBe(false)
  expect(filter(resolve('a/b.jsx'))).toBe(false)
})

test('allows setting an absolute base dir', () => {
  const baseDir = resolve('C')
  const filter = createFilter(['y*'], ['yx'], { resolve: baseDir })
  expect(filter(`${baseDir}/x`)).toBe(false)
  expect(filter(`${baseDir}/ys`)).toBe(true)
  expect(filter(`${baseDir}/yx`)).toBe(false)
  expect(filter(resolve('C/d/ys'))).toBe(false)
  expect(filter(resolve('ys'))).toBe(false)
  expect(filter('ys')).toBe(false)
})

test('allows setting a relative base dir', () => {
  const filter = createFilter(['y*'], ['yx'], { resolve: 'C/d' })
  expect(filter(resolve('C/d/x'))).toBe(false)
  expect(filter(resolve('C/d/ys'))).toBe(true)
  expect(filter(resolve('C/d/yx'))).toBe(false)
  expect(filter(`${resolve('C')}/ys`)).toBe(false)
  expect(filter(resolve('ys'))).toBe(false)
  expect(filter('ys')).toBe(false)
})

test('ignores a falsy resolve value', () => {
  const filter = createFilter(['y*'], ['yx'], { resolve: null })
  expect(filter(resolve('x'))).toBe(false)
  expect(filter(resolve('ys'))).toBe(true)
  expect(filter(resolve('yx'))).toBe(false)
  expect(filter(`${resolve('C')}/ys`)).toBe(false)
  expect(filter(resolve('C/d/ys'))).toBe(false)
  expect(filter('ys')).toBe(false)
})

test('allows preventing resolution against process.cwd()', () => {
  const filter = createFilter(['y*'], ['yx'], { resolve: false })
  expect(filter('x')).toBe(false)
  expect(filter('ys')).toBe(true)
  expect(filter('yx')).toBe(false)
  expect(filter(`${resolve('C')}/ys`)).toBe(false)
  expect(filter(resolve('C/d/ys'))).toBe(false)
  expect(filter(resolve('ys'))).toBe(false)
})

test('includes names starting with a "."', () => {
  const filter = createFilter(['**/*a'])
  expect(filter(resolve('.a'))).toBe(true)
  expect(filter(resolve('.x/a'))).toBe(true)
})

test('includes names containing parenthesis', () => {
  process.chdir(resolve(__dirname, 'fixtures/folder-with (parens)'))
  const filter = createFilter(
    ['*.ts+(|x)', '**/*.ts+(|x)'],
    ['*.d.ts', '**/*.d.ts'],
  )
  expect(filter(resolve('folder (test)/src/main.tsx'))).toBe(true)
  expect(filter(resolve('.x/(test)a.ts'))).toBe(true)
  expect(filter(resolve('.x/(test)a.d.ts'))).toBe(false)
})

test('handles relative paths', () => {
  const filter = createFilter(['./index.js', './foo/../a.js'])
  expect(filter(resolve('index.js'))).toBe(true)
  expect(filter(resolve('a.js'))).toBe(true)
  expect(filter(resolve('foo/a.js'))).toBe(false)
})

test('does not add current working directory when pattern is an absolute path', () => {
  const filter = createFilter([resolve('..', '..', '*')])
  expect(filter(resolve('..', '..', 'a'))).toBe(true)
  expect(filter(resolve('..', '..', 'b'))).toBe(true)
  expect(filter(resolve('..', 'c'))).toBe(false)
})

test('does not add current working directory when pattern starts with character **', () => {
  const filter = createFilter(['**/*'])

  expect(filter(resolve('a'))).toBe(true)
  expect(filter(resolve('..', '..', 'a'))).toBe(true)
})

test('add current working directory when pattern starts with one *', () => {
  const filter = createFilter([`*`])

  expect(filter(resolve('a'))).toBe(true)
  expect(filter(resolve('..', '..', 'a'))).toBe(false)
})

test('normalizes path when pattern is an absolute path', () => {
  const filterPosix = createFilter([`${resolve('.')}/*`])
  const filterWin = createFilter([String.raw`${resolve('.')}\*`])

  expect(filterPosix(resolve('a'))).toBe(true)
  expect(filterWin(resolve('a'))).toBe(true)
})

test('normalizes path when pattern starts with *', () => {
  const filterPosix = createFilter([`**/a`])
  const filterWin = createFilter([String.raw`**\a`])

  expect(filterPosix(resolve('a'))).toBe(true)
  expect(filterWin(resolve('a'))).toBe(true)
})

test('normalizes path when pattern has resolution base', () => {
  const filterPosix = createFilter([`test/*`], [], {
    resolve: __dirname,
  })
  const filterWin = createFilter([String.raw`test\*`], [], {
    resolve: __dirname,
  })

  expect(filterPosix(resolve('test/a'))).toBe(true)
  expect(filterWin(resolve('test/a'))).toBe(true)
})
