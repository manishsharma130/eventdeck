/** Extract a balanced object, respecting quoted strings and escapes. */
export function extractBalancedObject(input: string, start: number): string | null {
  if (start < 0 || input[start] !== '{') return null
  const stack: string[] = []
  let quoted = false
  let escaped = false
  for (let i = start; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') quoted = false
      continue
    }
    if (c === '"') quoted = true
    else if (c === '{' || c === '[') stack.push(c)
    else if (c === '}' || c === ']') {
      if (stack.pop() !== (c === '}' ? '{' : '[')) return null
      if (!stack.length) return input.slice(start, i + 1)
    }
  }
  return null
}
