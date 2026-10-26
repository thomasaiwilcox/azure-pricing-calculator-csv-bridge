const {test} = require('node:test');
const assert = require('node:assert/strict');
const bridge = require('../web/import-snippet.js');
const vm = require('../fixtures/templates/virtual-machines.json');
const disk = require('../fixtures/templates/managed-disks.json');

test('ARM region aliases resolve through observed Microsoft region names', () => {
  const regions = [{slug:'united-kingdom-south',displayName:'UK South'}];
  assert.equal(bridge.regionFor('uksouth',regions),'united-kingdom-south');
  assert.equal(bridge.regionFor('united-kingdom-south',regions),'united-kingdom-south');
  assert.throws(()=>bridge.regionFor('southuk',regions),/Unknown/);
});
test('ARM SKU maps to one exact metadata size without a fuzzy substitute', () => {
  const sizes=[{slug:'d4sv5',displayName:'D4s v5'},{slug:'d8sv5',displayName:'D8s v5'}];
  assert.equal(bridge.sizeFor('Standard_D4s_v5',sizes),'d4sv5');
  assert.throws(()=>bridge.sizeFor('Standard_D4_v5',sizes),/Unknown/);
});
test('unknown schema fields and field-type changes stop import', () => {
  const schema=Object.fromEntries(Object.entries(vm.schema_signature).map(([k,v])=>[k,v==='number'?0:v==='boolean'?false:v==='string'?'':v==='array'?[]:{}]));
  schema.version=vm.golden.version;
  bridge.sameSchema(vm,schema);
  assert.throws(()=>bridge.sameSchema(vm,{...schema,unexpected:1}),/changed/);
  assert.throws(()=>bridge.sameSchema(vm,{...schema,count:'1'}),/changed/);
});
test('VM availability is required in the requested region', () => {
  const row={service:'virtual-machines',sku:'Standard_D4s_v5',os:'linux',os_type:'ubuntu',quantity:1,hours:730,custom_name:'[1] web'};
  const catalog={metadata:{sizesPayGo:[{slug:'d4sv5',displayName:'D4s v5'}]},regional:{offers:{'linux-d4sv5-standard':{prices:{perhour:{'us-east':{value:0.2}}}}}}};
  const module=bridge.makeModule(row,vm,'us-east',catalog);
  assert.equal(module.interRegionUnits,0);
  assert.equal(module.managedDisks,0);
  assert.equal(module.total,0); // Only the actual site can turn this into evidence.
  assert.throws(()=>bridge.makeModule(row,vm,'united-kingdom-south',catalog),/unavailable/);
  assert.equal(vm.golden.size,'d2v3');
});
test('disk capacity must match the exact live tier and meter', () => {
  const row={service:'managed-disks',sku:'P30',quantity:2,storage_size_gib:1024,custom_name:'[d] disk'};
  const catalog={disk:{offers:{'premiumssd-p30-lrs':{size:1024,prices:{'us-east':{value:135}}}}}};
  const module=bridge.makeModule(row,disk,'us-east',catalog);
  assert.equal(module.managedDisks,2);
  assert.equal(module.managedDiskRedundancy,'lrs');
  assert.throws(()=>bridge.makeModule({...row,storage_size_gib:512},disk,'us-east',catalog),/capacity/);
});
test('browser validates identity and licensing even for hand-edited JSON', () => {
  const row={source_row:2,batch_id:'wave',line_id:'vm-1',label:'web',custom_name:'[wave/vm-1] web',region:'uksouth',sku:'Standard_D4s_v5',quantity:1,pricing_option:'payg',service:'virtual-machines',os:'windows',os_type:'os-only',license:'included',hours:730};
  const job={format:'calcbridge-job/v2',run_id:'test',source_sha256:'a'.repeat(64),currency:'USD',pricing_context:'public',support:'basic',templates:{},loading:{chunk_size:50,max_attempts:3,initial_backoff_ms:1000,max_backoff_ms:30000},estimate:{name:'CSV-wave-test',rows:[row]}};
  bridge.validateJob(job);
  const changed=structuredClone(job); changed.estimate.rows[0].license='ahb';
  assert.throws(()=>bridge.validateJob(changed),/licensing/);
  const duplicate=structuredClone(job);duplicate.estimate.rows.push(duplicate.estimate.rows[0]);
  assert.throws(()=>bridge.validateJob(duplicate),/Duplicate line/);
});

const retrySettings={max_attempts:3,initial_backoff_ms:1000,max_backoff_ms:30000};
test('transient failures use bounded exponential backoff and eventually succeed',async()=>{
  let attempts=0;const delays=[],events=[];
  const result=await bridge.withRetries(async()=>{if(++attempts<3)throw new bridge.BridgeError('HTTP 503',{status:503,retryable:true});return 'ready';},
    retrySettings,e=>events.push(e),async ms=>delays.push(ms),()=>0.5);
  assert.equal(result,'ready');assert.equal(attempts,3);assert.deepEqual(delays,[1000,2000]);assert.equal(events.length,2);
});
test('authentication, bad requests and oversized exports are never retried',async()=>{
  for(const status of [400,401,403,404,413]){
    let attempts=0;
    await assert.rejects(()=>bridge.withRetries(async()=>{attempts++;throw new bridge.BridgeError('HTTP '+status,{status});},retrySettings,()=>{},async()=>assert.fail('unexpected wait')));
    assert.equal(attempts,1);
  }
  assert.equal(bridge.isTransient(new bridge.BridgeError('CSV item-500 has the wrong SKU')),false);
});
test('Retry-After is honored and long pauses are deferred without early requests',async()=>{
  const delays=[];let attempts=0;
  await bridge.withRetries(async()=>{if(++attempts===1)throw new bridge.BridgeError('HTTP 429',{status:429,retryable:true,retryAfterMs:5000});return true;},
    retrySettings,()=>{},async ms=>delays.push(ms),()=>0.5);
  assert.deepEqual(delays,[5000]);assert.equal(bridge.retryAfter('5'),5000);
  assert.equal(bridge.retryAfter('Thu, 22 Oct 2026 14:00:05 GMT',Date.parse('2026-10-22T14:00:00Z')),5000);
  attempts=0;
  await assert.rejects(()=>bridge.withRetries(async()=>{attempts++;throw new bridge.BridgeError('HTTP 429',{status:429,retryable:true,retryAfterMs:120000});},
    retrySettings,()=>{},async()=>assert.fail('long wait must be deferred')),/longer pause/);
  assert.equal(attempts,1);
});
test('retry exhaustion preserves the failure and never exceeds its budget',async()=>{
  let count=0;const failure=new TypeError('Failed to fetch');
  await assert.rejects(()=>bridge.withRetries(async()=>{count++;throw failure;},retrySettings,()=>{},async()=>{},()=>0.5),e=>e===failure);
  assert.equal(count,3);
});
test('Retry-After on the last permitted attempt still blocks early resume',async()=>{
  const now=Date.now();
  await assert.rejects(()=>bridge.withRetries(async()=>{throw new bridge.BridgeError('HTTP 429',{status:429,retryable:true,retryAfterMs:5000});},
    {...retrySettings,max_attempts:1},()=>{},async()=>assert.fail('no attempts remain')),
    error=>error.retryAt>=now+5000);
});
test('compact native export changes only the proven unused VM cache',()=>{
  const fixture=require('../fixtures/native-export-small.json');const before=bridge.stable(fixture.payload);
  const compact=bridge.compactExportPayload(fixture.payload);
  assert.equal(bridge.stable(fixture.payload),before);
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) < Buffer.byteLength(JSON.stringify(fixture.payload))*0.4);
  compact.instances.forEach((instance,index)=>{
    const original=structuredClone(fixture.payload.instances[index]);
    if(original.serviceSlug==='virtual-machines')delete original.prices.premiumssdV2Offer;
    assert.deepEqual(instance,original);
  });
  const unsupported=structuredClone(fixture.payload);unsupported.instances[0].managedDisks=1;
  assert.deepEqual(bridge.compactExportPayload(unsupported).instances[0],unsupported.instances[0]);
});

test('native fields preserve typed service configuration and exclude supplied price outputs',()=>{
  const template=require('../fixtures/catalog/storage.json');
  const row={format:'native',service:'storage',custom_name:'[storage/example] Storage',configuration:structuredClone(template.configuration)};
  const module=bridge.makeNativeModule(row,template);
  for(const key of Object.keys(row.configuration))assert.deepEqual(module[key],row.configuration[key]);
  assert.equal(module.total,0);assert.equal(module.displayName,row.custom_name);
  const changed=structuredClone(row);changed.configuration.count='1000';
  assert.throws(()=>bridge.makeNativeModule(changed,template),/type/);
  changed.configuration=structuredClone(row.configuration);changed.configuration.total=100;
  assert.throws(()=>bridge.makeNativeModule(changed,template),/fields differ/);
  const nestedTemplate=require('../fixtures/catalog/virtual-machines--dedicated-host.json');
  const nested={format:'native',service:nestedTemplate.service,custom_name:'[host/example] Host',configuration:structuredClone(nestedTemplate.configuration)};
  nested.configuration.softwareAhb=[true];
  assert.deepEqual(bridge.makeNativeModule(nested,nestedTemplate).softwareAhb,[true]);
});
test('native endpoint mapping preserves observed dependencies and exact region slugs',()=>{
  assert.equal(bridge.nativeEndpoint({slug:'storage\\files',version:'v3'}),'/api/v3/pricing/storage/files/calculator/?culture=en-us&discount=mca');
  assert.equal(bridge.nativeEndpoint({slug:'virtual-machines',version:'v4',region:'us-east'},'united-kingdom-south'),'/api/v4/pricing/virtual-machines/calculator/united-kingdom-south/?culture=en-us&discount=mca');
  assert.throws(()=>bridge.nativeEndpoint({slug:'../../user/info',version:'v3'}),/Invalid/);
});
test('native request scheduling caps concurrent catalog reads',async()=>{
  const schedule=bridge.requestQueue(2);let active=0,max=0;
  await Promise.all(Array.from({length:5},()=>schedule(async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,180));active--;})));
  assert.equal(max,2);assert.equal(active,0);
});
test('unpriced native base placeholders cannot pass as fresh zero-cost pricing',()=>{
  const template=require('../fixtures/catalog/cost-management.json');
  const row={format:'native',service:'cost-management',line_id:'sample',source_row:2,custom_name:'[cost/sample] Cost',configuration:structuredClone(template.configuration)};
  const expected=bridge.makeNativeModule(row,template);
  const estimate={estimateName:'CSV-cost',modules:[{index:'module-1',currentModuleState:structuredClone(expected)}],
    currentCurrency:{value:'USD',locked:false},discounts:{base:'mca',additional:[]},enrollment:'',
    microsoftCustomerAgreementAccount:{id:''},microsoftCustomerAgreementProfile:{id:''},microsoftCustomerAgreementTenant:'',
    supportLevel:'free',markupPercentage:0,estimatePrice:0,estimateUpfrontPrice:0};
  const item={batch:{name:'CSV-cost',rows:[row]},instances:[expected],nativeTemplates:{'cost-management':template}};
  assert.throws(()=>bridge.verifyEstimate({activeEstimateId:'owned',estimates:{owned:estimate}},item,'USD'),/fresh price/);
});
test('checkpoint ownership rejects switched, edited and unexpectedly extended estimates',()=>{
  const {currency,payload}=require('../fixtures/native-export-small.json');
  const modules=payload.instances.map((state,index)=>({index:'module-'+index,serviceSlug:state.serviceSlug,currentModuleState:structuredClone(state)}));
  const item={instances:structuredClone(payload.instances),batch:{name:payload.name,rows:payload.instances.map((state,index)=>({source_row:index+2,batch_id:'source',line_id:'line-'+index,custom_name:state.displayName,hours:state.hours,service:state.serviceSlug}))}};
  const estimate={id:'owned',estimateName:payload.name,modules,currentCurrency:{value:currency,locked:false},discounts:{base:'mca',additional:[]},
    enrollment:'',microsoftCustomerAgreementAccount:{id:''},microsoftCustomerAgreementProfile:{id:''},microsoftCustomerAgreementTenant:'',supportLevel:'free',markupPercentage:0};
  const checkpoint={estimate_id:'owned',module_ids:modules.map(m=>m.index),committed_count:3,pending_until:3};
  const app={activeEstimateId:'owned',estimates:{owned:estimate}};const store={getState:()=>({app})};
  assert.equal(bridge.ownedEstimate(store,checkpoint,item,currency),estimate);
  app.activeEstimateId='another';assert.throws(()=>bridge.ownedEstimate(store,checkpoint,item,currency),/Switch back/);app.activeEstimateId='owned';
  modules[0].currentModuleState.count=999;assert.throws(()=>bridge.ownedEstimate(store,checkpoint,item,currency),/changed count/);modules[0].currentModuleState.count=payload.instances[0].count;
  modules.push(modules[0]);assert.throws(()=>bridge.ownedEstimate(store,checkpoint,item,currency),/unexpected/);modules.pop();
  modules[0].index='different';assert.throws(()=>bridge.ownedEstimate(store,checkpoint,item,currency),/IDs changed/);
});
