import { describe,expect,it } from 'vitest'
import type { EventFlow,LogEntry } from '../shared/types.js'
import { FlowValidator } from './validator.js'
const flow:EventFlow={id:'f',name:'Signup',validationMode:'presence',createdAt:'',updatedAt:'',events:[{id:'1',eventName:'opened'},{id:'2',eventName:'done'}]}
const log=(id:number,eventName:string):LogEntry=>({id,eventName,timestamp:'',deviceId:'d',tag:'t',message:{eventName},raw:''})
describe('presence validation',()=>{it('matches in any order and passes',()=>{const v=new FlowValidator();v.start(flow);expect(v.consume(log(1,'done'))?.matchedCount).toBe(1);expect(v.consume(log(2,'opened'))?.state).toBe('passed')});it('marks waiting events missing when stopped',()=>{const v=new FlowValidator();v.start(flow);v.consume(log(1,'opened'));expect(v.stop()?.state).toBe('failed');expect(v.result?.statuses[1].status).toBe('missing')})})
