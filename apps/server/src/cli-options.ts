export type CliAction = 'start' | 'help' | 'version'

export const cliHelp = `EventDeck local server

Usage:
  eventdeck start       Start the local EventDeck server
  eventdeck --help      Show this help message
  eventdeck --version   Show the installed EventDeck version

Options:
  -h, --help            Show help
  -v, --version         Show version`

export function parseCliArguments(arguments_: string[]): CliAction {
  if (arguments_.length === 0) return 'start'
  if (arguments_.length > 1) throw new Error(`Unexpected arguments: ${arguments_.slice(1).join(' ')}`)

  const [command] = arguments_
  if (command === 'start') return 'start'
  if (command === 'help' || command === '-h' || command === '--help') return 'help'
  if (command === 'version' || command === '-v' || command === '--version') return 'version'
  throw new Error(`Unknown command: ${command}`)
}
