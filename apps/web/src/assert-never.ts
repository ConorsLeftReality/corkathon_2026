export function assertNever(value: never): never {
  throw new Error(`unhandled case: ${String(value)}`)
}
