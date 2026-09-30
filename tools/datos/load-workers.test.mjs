import assert from 'node:assert/strict';
import test from 'node:test';
import {parallel} from './load-workers.mjs';
test('El fallo detiene nuevos trabajos y espera los ya enviados',async()=>{
  const gates=Array.from({length:3},()=>Promise.withResolvers()),started=[],completed=[];
  const failure=Error('fixture'),run=parallel([0,1,2,3,4,5],3,async value=>{started.push(value);await gates[value].promise;completed.push(value);});
  const observed=run.then(()=>({ok:true}),error=>({error}));
  gates[0].reject(failure);await Promise.resolve();await Promise.resolve();
  equalStarted();let finished=false;observed.then(()=>finished=true);await Promise.resolve();assert.equal(finished,false);
  gates[1].resolve();gates[2].resolve();const result=await observed;
  assert.equal(result.error,failure);equalStarted();assert.deepEqual(completed,[1,2]);
  function equalStarted(){assert.deepEqual(started,[0,1,2]);}
});
test('Procesa cada elemento una vez al completar sin fallos',async()=>{const seen=[];await parallel([10,20,30,40],2,async(item,index)=>{seen.push([item,index]);});assert.deepEqual(seen.sort((a,b)=>a[1]-b[1]),[[10,0],[20,1],[30,2],[40,3]]);});
