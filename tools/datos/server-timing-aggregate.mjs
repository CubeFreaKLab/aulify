import {serverTiming} from './server-timing.mjs';

const stages=['prepare','rpc','encode'];
export function observeServerTiming(operation, header, elapsedMs) {
 const timing=serverTiming(header);
 if(!Number.isFinite(elapsedMs)||elapsedMs<0||!stages.every(stage=>Number.isFinite(timing?.[stage])))return;
 const samples=operation.serverTimingSamples ||= {prepare:[],rpc:[],encode:[],outsideHandler:[]};
 for(const stage of stages)samples[stage].push(timing[stage]);
 // El residuo corresponde a la misma solicitud; no se restan percentiles.
 // Conservar pequeños negativos debidos a la resolución de los relojes.
 samples.outsideHandler.push(elapsedMs-stages.reduce((sum,stage)=>sum+timing[stage],0));
}
export function summarizeServerTiming(operation, percentile) {
 const samples=operation.serverTimingSamples;
 if(!samples)return {samples:0};
 return {samples:samples.rpc.length,
  p95Ms:Object.fromEntries(Object.entries(samples).map(([key,values])=>[key,percentile(values,0.95)])),
  negativeResiduals:samples.outsideHandler.filter(value=>value<0).length};
}
