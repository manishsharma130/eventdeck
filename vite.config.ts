import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
export default defineConfig({root:'web',plugins:[react()],resolve:{alias:{'@':path.resolve('web/src'),'@shared':path.resolve('shared')}},build:{outDir:'../web-dist',emptyOutDir:true},server:{port:5173,proxy:{'/ws':{target:'ws://127.0.0.1:3000',ws:true},'/api':'http://127.0.0.1:3000'}}})
