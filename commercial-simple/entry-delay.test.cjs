const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('/tmp/mirsad-commercial/extension/content.js','utf8');
const ready=code.slice(code.indexOf('function mirsadEntryReady()'),code.indexOf('async function ',code.indexOf('function mirsadEntryReady()')));
const start=code.indexOf('async function ',code.indexOf('function mirsadEntryReady()'));
const end=code.indexOf('\n    !window.__mirsadAutoPageHandshake',start);
const fallback=code.slice(start,end),name=/async function (\w+)/.exec(fallback)[1],choose=/if \((\w+)\(\)\) return await/.exec(fallback)[1];
function run(controls,chooseResult=false){const waits=[],state={calls:0};const context={document:{querySelectorAll:()=>controls},setTimeout:(fn,ms)=>{waits.push(ms);fn()},[choose]:()=>{state.calls++;return chooseResult}};vm.createContext(context);vm.runInContext(ready+fallback,context);return context[name]().then(result=>({result,waits,calls:state.calls}));}
const button=(label,extra={})=>({innerText:label,getAttribute:()=>null,getClientRects:()=>[{}],...extra});
test('ready Arabic and English join controls skip all landing waits without clicking',async()=>{for(const label of ['Join now','الانضمام الآن'])assert.deepEqual(await run([button(label)]),{result:false,waits:[],calls:0})});
test('live roster skips fallback',async()=>assert.deepEqual(await run([button('',{id:'roster-button'})]),{result:false,waits:[],calls:0}));
test('hidden or disabled Join keeps bounded loading retries',async()=>{for(const control of [button('Join',{disabled:true}),button('Join',{getClientRects:()=>[]})])assert.deepEqual((await run([control])).waits,[1000,1000,1000])});
test('explicit browser fallback still receives its navigation wait',async()=>assert.deepEqual(await run([],true),{result:true,waits:[1800],calls:1}));
test('only initial delay removed; organizer safety wait and post-join settling retained',()=>{assert.ok(!new RegExp('setTimeout\\([^,]+, 2000\\)\\), await '+name).test(code));assert.match(code,/setTimeout\([^,]+, 5000\)/);assert.match(code,/setTimeout\([^,]+, 2000\)/)});
