import { describe, expect, it } from 'vitest'
import { cliHelp, parseCliArguments } from '../../src/cli-options.js'

describe('EventDeck CLI options', () => {
  it.each([
    [[], 'start'],
    [['start'], 'start'],
    [['help'], 'help'],
    [['-h'], 'help'],
    [['--help'], 'help'],
    [['version'], 'version'],
    [['-v'], 'version'],
    [['--version'], 'version'],
  ] as const)('parses %j as %s', (arguments_, action) => {
    expect(parseCliArguments([...arguments_])).toBe(action)
  })

  it('rejects unknown commands and extra arguments', () => {
    expect(() => parseCliArguments(['launch'])).toThrow('Unknown command: launch')
    expect(() => parseCliArguments(['start', '--unknown'])).toThrow('Unexpected arguments: --unknown')
  })

  it('documents the supported public commands', () => {
    expect(cliHelp).toContain('eventdeck start')
    expect(cliHelp).toContain('eventdeck --help')
    expect(cliHelp).toContain('eventdeck --version')
  })
})
