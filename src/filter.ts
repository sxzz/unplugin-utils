import { isAbsolute, join, resolve } from 'pathe'
import pm from 'picomatch'
import { normalizePath } from './path'
import { toArray } from './utils'

const escapeMark = '[_#EsCaPe#_]'

function getMatcherString(
  id: string,
  resolutionBase: string | false | null | undefined,
) {
  if (resolutionBase === false || isAbsolute(id) || id.startsWith('**')) {
    return normalizePath(id)
  }

  // resolve('') is valid and will default to process.cwd()
  const basePath = normalizePath(resolve(resolutionBase || ''))
    // escape all possible (posix + win) path characters that might interfere with regex
    .replaceAll(/[-^$*+?.()|[\]{}]/g, `${escapeMark}$&`)
  // Note that we use posix.join because:
  // 1. the basePath has been normalized to use /
  // 2. the incoming glob (id) matcher, also uses /
  // otherwise Node will force backslash (\) on windows
  return join(basePath, normalizePath(id)).replaceAll(escapeMark, '\\')
}

/**
 * A valid `picomatch` glob pattern, or array of patterns.
 */
export type FilterPattern =
  | ReadonlyArray<string | RegExp>
  | string
  | RegExp
  | null

/**
 * Constructs a filter function which can be used to determine whether or not
 * certain modules should be operated upon.
 * @param include If `include` is omitted or has zero length, filter will return `true` by default.
 * @param exclude ID must not match any of the `exclude` patterns.
 * @param options Additional options.
 * @param options.resolve Optionally resolves the patterns against a directory other than `process.cwd()`.
 * If a `string` is specified, then the value will be used as the base directory.
 * Relative paths will be resolved against `process.cwd()` first.
 * If `false`, then the patterns will not be resolved against any directory.
 * This can be useful if you want to create a filter for virtual module names.
 */
export function createFilter(
  include?: FilterPattern,
  exclude?: FilterPattern,
  options?: { resolve?: string | false | null },
): (id: string | unknown) => boolean {
  const resolutionBase = options && options.resolve

  const getMatcher = (id: string | RegExp) =>
    id instanceof RegExp
      ? id
      : {
          test: (what: string) => {
            // this refactor is a tad overly verbose but makes for easy debugging
            const pattern = getMatcherString(id, resolutionBase)
            const fn = pm(pattern, { dot: true })
            const result = fn(what)

            return result
          },
        }

  const includeMatchers = toArray(include).map(getMatcher)
  const excludeMatchers = toArray(exclude).map(getMatcher)

  if (!includeMatchers.length && !excludeMatchers.length)
    return (id) => typeof id === 'string' && !id.includes('\0')

  return function result(id: string | unknown): boolean {
    if (typeof id !== 'string') return false
    if (id.includes('\0')) return false

    const pathId = normalizePath(id)

    for (const matcher of excludeMatchers) {
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0
      }
      if (matcher.test(pathId)) return false
    }

    for (const matcher of includeMatchers) {
      if (matcher instanceof RegExp) {
        matcher.lastIndex = 0
      }
      if (matcher.test(pathId)) return true
    }

    return !includeMatchers.length
  }
}
