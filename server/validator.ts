import type { EventFlow, FlowValidationResult, LogEntry } from '../shared/types.js'
export class FlowValidator{
  flow?:EventFlow; result?:FlowValidationResult
  start(flow:EventFlow){this.flow=flow;this.result={flowId:flow.id,state:'running',statuses:flow.events.map(x=>({eventId:x.id,status:'waiting'})),matchedCount:0,totalCount:flow.events.length};return this.result}
  consume(log:LogEntry){if(!this.flow||!this.result||this.result.state!=='running'||!log.eventName)return null;let changed=false;this.flow.events.forEach((expected,i)=>{if(expected.eventName===log.eventName&&this.result!.statuses[i].status==='waiting'){this.result!.statuses[i]={eventId:expected.id,status:'found',logId:log.id};changed=true}});if(changed){this.result.matchedCount=this.result.statuses.filter(x=>x.status==='found').length;if(this.result.matchedCount===this.result.totalCount)this.result.state='passed'}return changed?this.result:null}
  stop(){if(!this.result)return null;if(this.result.state==='running'){this.result.statuses=this.result.statuses.map(x=>x.status==='waiting'?{...x,status:'missing'}:x);this.result.state=this.result.statuses.some(x=>x.status==='missing')?'failed':'passed'}return this.result}
}
