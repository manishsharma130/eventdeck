import { describe, expect, it, vi } from 'vitest'
import { ConnectorRegistry } from '../../src/connectors/connector-registry.js'
import { parseLogcatEntry } from '../../src/logcat/logcat-line-parser.js'
import { DEFAULT_CONNECTOR_SETTINGS } from '../../src/settings/connector-settings.js'
import type { LogcatEntry } from '../../src/logcat/logcat.types.js'

const registry = new ConnectorRegistry()
const entry = (tag: string, message: string, level: LogcatEntry['level'] = 'V'): LogcatEntry => ({ tag, message, level, timestamp: 1234, raw: message })
const ga = (body: string) => registry.parse(entry('FA-SVC', body))
const mo = (event: unknown) => registry.parse(entry('MoEngage', `random42 Core_EventHandler trackEvent(): { Event: ${JSON.stringify(event)}}`, 'D'))

describe('connector parsers and routing', () => {
  it('normalizes the core source and retains SDK timestamps', () => {
    expect(registry.parse(entry('AnalyticsEvent', '{"eventName":"open","timestamp":42,"eventParams":{"x":1}}', 'D'))).toEqual({ eventName: 'open', eventTag: 'analytics_event', timestamp: 42, eventParams: { x: 1 } })
  })
  it.each(['google_analytics', 'AnalyticsEvent', 'custom SDK tag', ''])('preserves the core payload eventTag exactly: %s', eventTag => {
    const event = registry.parse(entry('AnalyticsEvent', JSON.stringify({ eventName: 'open', eventTag, eventParams: {} })), { google_analytics: false, branch: false, moengage: false })
    expect(event?.eventTag).toBe(eventTag)
  })
  it('parses nested Google Bundles without over-converting IDs', () => {
    expect(ga('Logging event: origin=app,name=edge_bundle_loading,params=Bundle[{device_manufacturer=OnePlus, device={app_version=15.2.1, device=android}, login_state=0, id=00123, empty=, nil=null, yes=true, no=false, list=[1, 2]}]')?.eventParams).toEqual({ device_manufacturer: 'OnePlus', device: { app_version: '15.2.1', device: 'android' }, login_state: 0, id: '00123', empty: '', nil: null, yes: true, no: false, list: [1, 2] })
  })
  it.each(['Logging event: name=x', 'Logging event: params=Bundle[{}]', 'Logging event: name=,params=Bundle[{}]', 'Logging event: name=x,params=Bundle[{x={bad}]', 'Logging event: name=x,params=Bundle[{bad}]'])('ignores malformed Google payload %s', body => expect(ga(body)).toBeNull())
  it('parses Branch markers, whitespace, and balanced quoted braces', () => {
    expect(registry.parse(entry('BranchSDK', 'prefix setPost :  {"name":"purchase","currency":"INR","revenue":500,"text":"}\\\""} trailing'))).toMatchObject({ eventName: 'purchase', eventTag: 'branch', eventParams: { currency: 'INR', revenue: 500, text: '}"' } })
  })
  it.each(['setPost', 'setPost {bad}', 'setPost {"currency":"INR"}', 'setPost {"name":""}'])('ignores invalid Branch %s', body => expect(registry.parse(entry('BranchSDK', body))).toBeNull())
  it('parses MoEngage wrapper and escaped attributes', () => {
    expect(mo({ name: 'clicked', time: 1791034990094, attributes: { EVENT_ATTRS: JSON.stringify({ nested: { text: 'a "quote" }' } }) } })).toEqual({ eventName: 'clicked', eventTag: 'moengage', timestamp: 1791034990094, eventParams: { nested: { text: 'a "quote" }' } } })
    expect(mo({ name: 'clicked', attributes: { EVENT_ATTRS: { ok: true } } })?.timestamp).toBe(1234)
    expect(mo({ name: 'clicked', time: 'bad', attributes: { EVENT_ATTRS: {} } })?.timestamp).toBe(1234)
  })
  it.each([{ attributes: { EVENT_ATTRS: {} } }, { name: 'x' }, { name: 'x', attributes: {} }, { name: 'x', attributes: { EVENT_ATTRS: 'invalid' } }])('ignores invalid MoEngage', event => expect(mo(event)).toBeNull())
  it('ignores unrelated tags, incorrect levels, invalid core JSON and disabled connectors', () => {
    expect(registry.parse(entry('Other', '{"eventName":"x"}'))).toBeNull()
    expect(registry.parse(entry('BranchSDK', 'setPost {"name":"x"}', 'D'))).toBeNull()
    expect(registry.parse(entry('AnalyticsEvent', '{bad'))).toBeNull()
    expect(registry.parse(entry('BranchSDK', 'setPost {"name":"x"}'), { ...DEFAULT_CONNECTOR_SETTINGS, branch: false })).toBeNull()
  })
  it('isolates a throwing connector', () => {
    const broken = new ConnectorRegistry([{ id: 'branch', logcatFilters: ['BranchSDK:V'], matches: () => true, parse: () => { throw Error('broken') } }])
    expect(broken.parse(entry('BranchSDK', 'anything'))).toBeNull()
  })
})
describe('Logcat metadata and connector setup', () => {
  it('parses threadtime and resolves the previous year near New Year', () => {
    const parsed = parseLogcatEntry('12-31 23:59:59.212 30977 24895 V FA-SVC: Logging event: x', +new Date(2026, 0, 1))
    expect(parsed).toMatchObject({ pid: 30977, tid: 24895, level: 'V', tag: 'FA-SVC', message: 'Logging event: x' })
    expect(new Date(parsed!.timestamp).getFullYear()).toBe(2025)
    expect(parseLogcatEntry('--------- beginning of main')).toBeNull()
    expect(parseLogcatEntry('99-99 23:59:59.212 1 2 V FA: x')).toBeNull()
  })
  it('builds filters and always keeps the core connector', () => {
    expect(registry.getFilters(DEFAULT_CONNECTOR_SETTINGS)).toEqual(['AnalyticsEvent:V', 'FA:V', 'FA-SVC:V', 'BranchSDK:V', 'MoEngage:D'])
    expect(registry.getFilters({ ...DEFAULT_CONNECTOR_SETTINGS, branch: false })).not.toContain('BranchSDK:V')
    expect(registry.getFilters({ google_analytics: false, branch: false, moengage: false })).toEqual(['AnalyticsEvent:V'])
  })
  it('runs exactly two device-scoped Google setup commands and none when disabled', async () => {
    const runAdbCommand = vi.fn(async () => undefined)
    await registry.setup(DEFAULT_CONNECTOR_SETTINGS, { deviceId: 'device-b', runAdbCommand })
    expect(runAdbCommand.mock.calls).toEqual([
      [['-s', 'device-b', 'shell', 'setprop', 'log.tag.FA', 'VERBOSE']],
      [['-s', 'device-b', 'shell', 'setprop', 'log.tag.FA-SVC', 'VERBOSE']],
    ])
    runAdbCommand.mockClear()
    await registry.setup({ ...DEFAULT_CONNECTOR_SETTINGS, google_analytics: false }, { deviceId: 'device-b', runAdbCommand })
    expect(runAdbCommand).not.toHaveBeenCalled()
  })
})
