export type DeviceStatus='online'|'offline'|'unauthorized'
export interface Device{id:string;model?:string;product?:string;device?:string;transportId?:string;status:DeviceStatus}
export type StreamState='stopped'|'running'|'paused'
export type RecordingState='idle'|'recording'
export interface LogEntry{id:number;timestamp:string;deviceId:string;tag:string;level?:string;eventName?:string;eventTag?:string;message:Record<string,unknown>|string;raw:string}
export interface RecordedSession{id:string;name:string;createdAt:string;deviceId:string;deviceName?:string;totalLogs:number;sizeBytes?:number}
export interface ExpectedEvent{id:string;eventName:string;description?:string;conditions?:Array<{path:string;operator:'equals'|'exists';value?:unknown}>}
export interface EventFlow{id:string;name:string;description?:string;validationMode:'presence'|'ordered';events:ExpectedEvent[];createdAt:string;updatedAt:string}
export interface FlowValidationResult{flowId:string;state:'idle'|'running'|'passed'|'failed';statuses:Array<{eventId:string;status:'waiting'|'found'|'missing';logId?:number}>;matchedCount:number;totalCount:number}
export type ServerMessage=
|{type:'bootstrap';devices:Device[];sessions:RecordedSession[];flows:EventFlow[];streamState:StreamState;recordingState:RecordingState;adbAvailable:boolean}
|{type:'devices:update';devices:Device[]}|{type:'logs:batch';logs:LogEntry[]}|{type:'logs:clear'}|{type:'stream:state';state:StreamState}|{type:'recording:state';state:RecordingState}|{type:'session:saved';session:RecordedSession}|{type:'session:loaded';session:RecordedSession;logs:LogEntry[]}|{type:'sessions:update';sessions:RecordedSession[]}|{type:'flows:update';flows:EventFlow[]}|{type:'flow:validation-update';result:FlowValidationResult}|{type:'error';message:string}
export type ClientMessage=
|{type:'stream:start';deviceId:string}|{type:'stream:pause'}|{type:'stream:resume'}|{type:'stream:stop'}|{type:'stream:clear'}|{type:'recording:start'}|{type:'recording:stop';name:string}|{type:'session:open';sessionId:string}|{type:'session:delete';sessionId:string}|{type:'flow:save';flow:EventFlow}|{type:'flow:delete';flowId:string}|{type:'flow:start-validation';flowId:string}|{type:'flow:stop-validation';flowId:string}
