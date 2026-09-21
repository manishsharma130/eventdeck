import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'
import type { Device, LogEntry } from '../shared/types.js'

export function parseDevices(output:string):Device[]{return output.split(/\r?\n/).slice(1).filter(Boolean).map(line=>{const [id,state,...parts]=line.trim().split(/\s+/);const props=Object.fromEntries(parts.map(part=>part.split(':',2)).filter(x=>x.length===2));return{id,status:state==='device'?'online':state==='unauthorized'?'unauthorized':'offline',model:props.model?.replaceAll('_',' '),product:props.product,device:props.device,transportId:props.transport_id}})}

export function parseLogLine(raw:string,deviceId:string,id:number,filterTag='AnalyticsEvent'):LogEntry|null{
  const match=raw.match(/^(\d\d-\d\d\s+\d\d:\d\d:\d\d\.\d+)\s+\d+\s+\d+\s+([VDIWEF])\s+([^:]+):\s?(.*)$/)
  const body=(match?.[4]??raw).trim(); const tag=(match?.[3]??filterTag).trim()
  if(filterTag&&tag!==filterTag&&!body.includes('{'))return null
  const start=body.indexOf('{'); let message:Record<string,unknown>|string=body
  if(start>=0){try{message=JSON.parse(body.slice(start))}catch{message=body}}
  const obj=typeof message==='object'?message:undefined
  return{id,timestamp:match?.[1]??new Date().toISOString(),deviceId,tag:String(obj?.eventTag??tag),level:match?.[2],eventName:typeof obj?.eventName==='string'?obj.eventName:undefined,eventTag:typeof obj?.eventTag==='string'?obj.eventTag:undefined,message,raw}
}

function runAdb(args:string[],timeout=5000):Promise<string>{return new Promise((resolve,reject)=>{const child=spawn('adb',args,{stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{child.kill();reject(new Error('ADB command timed out'))},timeout);child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error(err||`ADB exited ${code}`))})})}
export async function adbAvailable(){try{await runAdb(['version']);return true}catch{return false}}
export async function listDevices(){return parseDevices(await runAdb(['devices','-l']))}

export class DeviceMonitor extends EventEmitter{
  #timer?:NodeJS.Timeout; #last=''
  start(){void this.poll();this.#timer=setInterval(()=>void this.poll(),2000)}
  async poll(){try{const devices=await listDevices();const next=JSON.stringify(devices);if(next!==this.#last){this.#last=next;this.emit('update',devices)}}catch{if(this.#last!=='[]'){this.#last='[]';this.emit('update',[])}}}
  stop(){if(this.#timer)clearInterval(this.#timer)}
}

export class LogcatStream extends EventEmitter{
  #child?:ChildProcessWithoutNullStreams; #nextId=1
  start(deviceId:string,tag:string){this.stop();this.#child=spawn('adb',['-s',deviceId,'logcat','-v','threadtime',`${tag}:V`,'*:S']);const lines=createInterface({input:this.#child.stdout});lines.on('line',raw=>{const log=parseLogLine(raw,deviceId,this.#nextId++,tag);if(log)this.emit('log',log)});this.#child.stderr.on('data',data=>this.emit('error',new Error(String(data))));this.#child.on('close',()=>this.emit('close'))}
  stop(){this.#child?.kill('SIGTERM');this.#child=undefined}
}
