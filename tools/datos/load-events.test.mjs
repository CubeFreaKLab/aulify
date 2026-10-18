import { test } from 'node:test';
import assert from 'node:assert/strict';
import { consumeEventFrames,openLoadEventStream } from './load-events.mjs';

test('interpreta eventos fragmentados y comentarios sin tratar cada latido como cambio',async()=>{
 const frames=[': ok\r','\n\r','\nevent: rea','dy\r\ndata: {}\r\n\r\n:event: changed\n\nevent: changed\ndata: {"activityChanged":true}\n\n'];
 const body=new ReadableStream({start(c){for(const f of frames)c.enqueue(new TextEncoder().encode(f));c.close();}});
 const events=[],data=[];let bytes=0;
 await consumeEventFrames(body,(name,payload)=>{events.push(name);data.push(payload);},n=>bytes+=n);
 assert.deepEqual(events,['ready','changed']);assert.ok(bytes>0);
 assert.deepEqual(data,['{}','{"activityChanged":true}']);
});
test('una cancelación voluntaria cierra el flujo sin registrar un fallo técnico',async()=>{
 let aborts=0,failed=0;
 const stream=openLoadEventStream({
  connect:async signal=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));signal.addEventListener('abort',()=>{aborts++;c.error(new Error('cancelled'));});}}),{headers:{'content-type':'text/event-stream'}}),
  opened:()=>{},failed:()=>failed++,event:()=>{},bytes:()=>{},
 });
 await stream.ready;await stream.stop();assert.equal(aborts,1);assert.equal(failed,0);
});
test('el rechazo de acceso no reintenta indefinidamente ni se convierte en sesión preparada',async()=>{
 let requests=0,failures=0;
 const stream=openLoadEventStream({connect:async()=>{requests++;return new Response('',{status:403});},opened:()=>{},failed:()=>failures++,event:()=>{},bytes:()=>{}});
 await assert.rejects(stream.ready);await stream.stop();assert.equal(requests,1);assert.equal(failures,1);
});
