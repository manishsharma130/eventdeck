import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ClientMessage, Device, LogEntry, ServerMessage, StreamState } from '../shared/types.js'
import { adbAvailable, DeviceMonitor, LogcatStream } from './adb.js'
import { Storage, RecordingWriter } from './storage.js'
import { FlowValidator } from './validator.js'

export interface EventDeckOptions{host?:string;port?:number;tag?:string;storageRoot?:string}
export async function createEventDeck(options:EventDeckOptions={}){
  const host=options.host??'127.0.0.1',port=options.port??3000,tag=options.tag??'AnalyticsEvent'
  const app=Fastify({logger:false});const storage=new Storage(options.storageRoot);await storage.init()
  const monitor=new DeviceMonitor(),logcat=new LogcatStream(),recording=new RecordingWriter(storage),validator=new FlowValidator()
  let devices:Device[]=[],streamState:StreamState='stopped',selectedDeviceId:string|undefined,batch:LogEntry[]=[]
  let sessions=await storage.sessions(),flows=await storage.flows();const available=await adbAvailable();const clients=new Set<WebSocket>()
  const send=(client:WebSocket,message:ServerMessage)=>{if(client.readyState===WebSocket.OPEN)client.send(JSON.stringify(message))};const broadcast=(message:ServerMessage)=>clients.forEach(c=>send(c,message))
  const setState=(state:StreamState)=>{streamState=state;broadcast({type:'stream:state',state})}
  monitor.on('update',(next:Device[])=>{devices=next;broadcast({type:'devices:update',devices});if(selectedDeviceId&&!devices.some(x=>x.id===selectedDeviceId&&x.status==='online')){logcat.stop();selectedDeviceId=undefined;setState('stopped')}})
  logcat.on('log',(log:LogEntry)=>{recording.write(log);const result=validator.consume(log);if(result)broadcast({type:'flow:validation-update',result});if(streamState==='running')batch.push(log)})
  logcat.on('error',(error:Error)=>broadcast({type:'error',message:error.message}));logcat.on('close',()=>{if(streamState!=='stopped')setState('stopped')})
  const flush=setInterval(()=>{if(batch.length){broadcast({type:'logs:batch',logs:batch.splice(0,500)})}},32)
  const handle=async(message:ClientMessage)=>{switch(message.type){
    case'stream:start':{const device=devices.find(x=>x.id===message.deviceId&&x.status==='online');if(!device)throw new Error('Select an online device before starting.');selectedDeviceId=device.id;logcat.start(device.id,tag);setState('running');break}
    case'stream:pause':setState('paused');break;case'stream:resume':setState('running');break
    case'stream:stop':logcat.stop();setState('stopped');{const result=validator.stop();if(result)broadcast({type:'flow:validation-update',result})}break
    case'stream:clear':batch=[];broadcast({type:'logs:clear'});break
    case'recording:start':{if(!selectedDeviceId)throw new Error('Start a stream before recording.');const device=devices.find(x=>x.id===selectedDeviceId);await recording.start(selectedDeviceId,device?.model);broadcast({type:'recording:state',state:'recording'});break}
    case'recording:stop':{const session=await recording.stop(message.name);broadcast({type:'recording:state',state:'idle'});if(session){sessions=await storage.sessions();broadcast({type:'session:saved',session});broadcast({type:'sessions:update',sessions})}break}
    case'session:open':{if(streamState!=='stopped'){logcat.stop();setState('stopped')}const data=await storage.openSession(message.sessionId);broadcast({type:'session:loaded',...data});break}
    case'session:delete':await storage.deleteSession(message.sessionId);sessions=await storage.sessions();broadcast({type:'sessions:update',sessions});break
    case'flow:save':await storage.saveFlow(message.flow);flows=await storage.flows();broadcast({type:'flows:update',flows});break
    case'flow:delete':await storage.deleteFlow(message.flowId);flows=await storage.flows();broadcast({type:'flows:update',flows});break
    case'flow:start-validation':{const flow=flows.find(x=>x.id===message.flowId);if(!flow)throw new Error('Event Flow not found.');broadcast({type:'flow:validation-update',result:validator.start(flow)});break}
    case'flow:stop-validation':{const result=validator.stop();if(result)broadcast({type:'flow:validation-update',result});break}
  }}
  app.get('/api/health',async()=>({status:'ok',version:'0.1.0',adbAvailable:available}))
  const moduleDir=path.dirname(fileURLToPath(import.meta.url));const webRoot=path.resolve(moduleDir,'../../web-dist');await app.register(fastifyStatic,{root:webRoot,wildcard:false});app.setNotFoundHandler((request,reply)=>request.url.startsWith('/api/')?reply.code(404).send({error:'Not found'}):reply.sendFile('index.html'))
  const wss=new WebSocketServer({noServer:true});wss.on('connection',client=>{clients.add(client);send(client,{type:'bootstrap',devices,sessions,flows,streamState,recordingState:recording.active?'recording':'idle',adbAvailable:available});client.on('message',async raw=>{try{await handle(JSON.parse(String(raw)))}catch(error){send(client,{type:'error',message:error instanceof Error?error.message:'Unexpected error'})}});client.on('close',()=>clients.delete(client))})
  app.server.on('upgrade',(request,socket,head)=>{if(request.url==='/ws')wss.handleUpgrade(request,socket,head,client=>wss.emit('connection',client,request));else socket.destroy()})
  const start=async()=>{await app.listen({host,port});if(available)monitor.start();return`http://${host}:${port}`}
  const close=async()=>{clearInterval(flush);monitor.stop();logcat.stop();if(recording.active)await recording.stop('Recovered session');clients.forEach(c=>c.close());wss.close();await app.close()}
  return{start,close,address:`http://${host}:${port}`}
}
