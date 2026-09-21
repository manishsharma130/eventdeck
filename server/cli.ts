#!/usr/bin/env node
import open from 'open'
import { createEventDeck } from './app.js'

const args=process.argv.slice(2);const value=(flag:string)=>{const i=args.indexOf(flag);return i>=0?args[i+1]:undefined}
if(args.includes('--help')||args.includes('-h')){console.log(`EventDeck — Stream. Validate. Debug.\n\nUsage: eventdeck [options]\n\n  --port <number>  Server port (default: 3000)\n  --tag <tag>      Logcat tag (default: AnalyticsEvent)\n  --no-open        Do not open the browser\n  --help           Show this help`);process.exit(0)}
const port=Number(value('--port')??3000);if(!Number.isInteger(port)||port<1||port>65535){console.error('Invalid --port value');process.exit(1)}
const runtime=await createEventDeck({port,tag:value('--tag')??'AnalyticsEvent'})
try{const url=await runtime.start();console.log(`\n  EventDeck v0.1.0\n  ${url}\n  Stream. Validate. Debug.\n`);if(!args.includes('--no-open'))await open(url)}catch(error){console.error(`Unable to start EventDeck: ${error instanceof Error?error.message:error}`);process.exit(1)}
let closing=false;const shutdown=async()=>{if(closing)return;closing=true;console.log('\nShutting down EventDeck…');await runtime.close();process.exit(0)};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown)
