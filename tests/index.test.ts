import { expect, test } from 'vitest'
import { normalizePath } from '../src'

test('path', () => {
  expect(normalizePath(String.raw`C:\foo\bar`)).toBe(String.raw`C:/foo/bar`)
  expect(normalizePath(`/path`)).toBe('/path')
})
