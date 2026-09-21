import { describe,expect,it } from 'vitest'
import { parseDevices,parseLogLine } from './adb.js'
describe('ADB parsing',()=>{
  it('parses online and unauthorized devices',()=>{expect(parseDevices('List of devices attached\nemulator-5554 device product:sdk model:Pixel_8 device:emu transport_id:1\nABC unauthorized usb:1-1\n')).toEqual([{id:'emulator-5554',status:'online',model:'Pixel 8',product:'sdk',device:'emu',transportId:'1'},{id:'ABC',status:'unauthorized',model:undefined,product:undefined,device:undefined,transportId:undefined}])})
  it('extracts AnalyticsEvent JSON without crashing on text',()=>{const log=parseLogLine('09-22 14:36:20.412  123  456 D AnalyticsEvent: {"eventName":"purchase","eventParams":{"product_id":"P1001","price":999},"eventTag":"google_analytics"}','device',1)!;expect(log.eventName).toBe('purchase');expect(log.eventTag).toBe('google_analytics');expect(log.message).toMatchObject({eventParams:{product_id:'P1001',price:999}});expect(parseLogLine('malformed { nope','device',2)?.message).toBe('malformed { nope')})
})
