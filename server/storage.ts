import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { EventFlow, LogEntry, RecordedSession } from '../shared/types.js'

export class Storage{
  root:string; sessionsDir:string; flowsDir:string
  constructor(root=process.env.EVENTDECK_HOME??path.join(homedir(),'.eventdeck')){this.root=root;this.sessionsDir=path.join(root,'sessions');this.flowsDir=path.join(root,'flows')}
  async init(){await Promise.all([mkdir(this.sessionsDir,{recursive:true}),mkdir(this.flowsDir,{recursive:true})])}
  async sessions(){const ids=await readdir(this.sessionsDir).catch(()=>[]);const items=await Promise.all(ids.map(async id=>{try{return JSON.parse(await readFile(path.join(this.sessionsDir,id,'metadata.json'),'utf8')) as RecordedSession}catch{return null}}));return items.filter((x):x is RecordedSession=>!!x).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}
  async openSession(id:string){const dir=path.join(this.sessionsDir,path.basename(id));const session=JSON.parse(await readFile(path.join(dir,'metadata.json'),'utf8')) as RecordedSession;const logs:LogEntry[]=[];if(existsSync(path.join(dir,'events.ndjson'))){const lines=createInterface({input:createReadStream(path.join(dir,'events.ndjson'))});for await(const line of lines){try{logs.push(JSON.parse(line))}catch{}}}return{session,logs}}
  async deleteSession(id:string){await rm(path.join(this.sessionsDir,path.basename(id)),{recursive:true,force:true})}
  async flows(){const names=(await readdir(this.flowsDir).catch(()=>[])).filter(x=>x.endsWith('.json'));const result=await Promise.all(names.map(async name=>{try{return JSON.parse(await readFile(path.join(this.flowsDir,name),'utf8')) as EventFlow}catch{return null}}));return result.filter((x):x is EventFlow=>!!x).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
  async saveFlow(flow:EventFlow){await writeFile(path.join(this.flowsDir,`${path.basename(flow.id)}.json`),JSON.stringify(flow,null,2))}
  async deleteFlow(id:string){await rm(path.join(this.flowsDir,`${path.basename(id)}.json`),{force:true})}
}

export class RecordingWriter{
  #stream?:ReturnType<typeof createWriteStream>;#dir='';#total=0;#bytes=0;#start?:{deviceId:string;deviceName?:string;createdAt:string;id:string}
  constructor(private storage:Storage){}
  get active(){return!!this.#stream}
  async start(deviceId:string,deviceName?:string){if(this.active)return;const id=crypto.randomUUID();this.#dir=path.join(this.storage.sessionsDir,id);await mkdir(this.#dir,{recursive:true});this.#start={id,deviceId,deviceName,createdAt:new Date().toISOString()};this.#stream=createWriteStream(path.join(this.#dir,'events.ndjson'),{flags:'a'})}
  write(log:LogEntry){if(!this.#stream)return;const line=JSON.stringify(log)+'\n';this.#total++;this.#bytes+=Buffer.byteLength(line);this.#stream.write(line)}
  async stop(name:string){if(!this.#stream||!this.#start)return null;const stream=this.#stream;await new Promise<void>((resolve,reject)=>{stream.once('error',reject);stream.end(resolve)});const session:RecordedSession={...this.#start,name:name.trim()||`Session ${new Date().toLocaleString()}`,totalLogs:this.#total,sizeBytes:this.#bytes};await writeFile(path.join(this.#dir,'metadata.json'),JSON.stringify(session,null,2));this.#stream=undefined;this.#start=undefined;this.#total=0;this.#bytes=0;return session}
}
