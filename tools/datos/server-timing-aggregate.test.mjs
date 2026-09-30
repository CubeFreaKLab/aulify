import test from 'node:test';
import assert from 'node:assert/strict';
import {observeServerTiming,summarizeServerTiming} from './server-timing-aggregate.mjs';
const percentile=(values,p)=>values.toSorted((a,b)=>a-b)[Math.ceil(values.length*p)-1];
test('el residuo conserva la relación de cada solicitud y no resta percentiles',()=>{
 const operation={};
 observeServerTiming(operation,'prepare;dur=10, rpc;dur=90, encode;dur=0',101);
 observeServerTiming(operation,'prepare;dur=90, rpc;dur=10, encode;dur=0',105);
 assert.deepEqual(summarizeServerTiming(operation,percentile),{
  samples:2,p95Ms:{prepare:90,rpc:90,encode:0,outsideHandler:5},negativeResiduals:0});
});
test('descarta instrumentación incompleta sin confundir ausencia con cero',()=>{
 const operation={};
 observeServerTiming(operation,'rpc;dur=300, secret;desc="private"',320);
 observeServerTiming(operation,null,0);
 observeServerTiming(operation,'prepare;dur=0, rpc;dur=0, encode;dur=0',NaN);
 assert.deepEqual(summarizeServerTiming(operation,percentile),{samples:0});
 observeServerTiming(operation,'prepare;dur=1, rpc;dur=2, encode;dur=3, token;desc="private"',5.99);
 assert.equal(summarizeServerTiming(operation,percentile).negativeResiduals,1);
 assert.equal(JSON.stringify(operation).includes('private'),false);
});
