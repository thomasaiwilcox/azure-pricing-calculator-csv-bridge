export const encode = s => new TextEncoder().encode(s);
export const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const canonical = x => (x === null || typeof x !== 'object' ? JSON.stringify(x) : Array.isArray(x) ? '['+x.map(canonical).join(',')+']' : '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}').replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function parseCSV(text) {
 text=text.replace(/^\ufeff/,''); let p=0,line=1, records=[];
 while(p<text.length){let cells=[],start=line,content=false;
  while(true){let v=''; if(text[p]==='"'){content=true;p++;let closed=false;while(p<text.length){let c=text[p++];if(c==='"'){if(text[p]==='"'){v+='"';p++;}else{closed=true;break;}}else{v+=c;if(c==='\r'){if(text[p]==='\n')v+=text[p++];line++;}else if(c==='\n')line++;}}check(closed,'Unterminated quoted cell at row '+start);check(p===text.length||',\r\n'.includes(text[p]),'Text after closing quote at row '+start);
  }else{while(p<text.length&&! ',\r\n'.includes(text[p])){check(text[p]!=='"','Unquoted quote at row '+start);v+=text[p++];content=true;}}
  cells.push(v);if(p===text.length)break;let c=text[p++];if(c===','){content=true;continue;}if(c==='\r'&&text[p]==='\n')p++;line++;break;
  }if(content)records.push({line:start,cells});
 }
 check(records.length>1,'CSV needs headers and resource rows');let headers=records.shift().cells;check(new Set(headers).size===headers.length,'Duplicate headers');
 for(const r of records)check(r.cells.length===headers.length,'Wrong cell count at row '+r.line);
 return {headers,records};
}
export const csvLine = cells => cells.map(v=>/[",\r\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':v).join(',')+'\r\n';
export function effective(file){return file.edited ? csvLine(file.headers)+file.records.map(r=>csvLine(r.cells)).join('') : file.original;}
export function edit(file,row,column,value){check(!['batch_id','line_id','service'].includes(file.headers[column]),'Identity is read-only');file.records[row].cells[column]=value;file.edited=JSON.stringify(file.records)!==JSON.stringify(parseCSV(file.original).records);}
export function strictJSON(text){
 // Scan object keys before JSON.parse so duplicate keys cannot be silently discarded.
 let i=0;const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
 const string=()=>{const start=i++;while(i<text.length){if(text[i++]==='"')return JSON.parse(text.slice(start,i));if(text[i-1]==='\\')i++;}throw Error('Unterminated JSON string');};
 function value(depth=0){check(depth<100,'JSON too deep');ws();let c=text[i];if(c==='"'){string();return;}if(c==='{'||c==='['){i++;ws();let end=c==='{'?'}':']',keys=new Set();if(text[i]===end){i++;return;}while(i<text.length){if(c==='{'){check(text[i]==='"','Expected JSON key');let k=string();check(!keys.has(k)&&!['__proto__','constructor','prototype'].includes(k),'Duplicate or unsafe JSON key');keys.add(k);ws();check(text[i++]===':','Expected colon');}value(depth+1);ws();if(text[i]===end){i++;return;}check(text[i++]===',','Expected comma');ws();}throw Error('Unclosed JSON');}let m=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(i));check(m,'Invalid JSON value');i+=m[0].length;}
 value();ws();check(i===text.length,'Trailing JSON content');return JSON.parse(text);
}
const nativeString=s=>{check(s.length<=1000&&!/[\x00-\x1f]/.test(s),'Invalid native string');return s;};
const number=(s,integer,min,max)=>{check(s!==''&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s),'Expected number');let n=Number(s);check(Number.isFinite(n)&&n>=min&&n<=max&&(!integer||Number.isSafeInteger(n)),'Number outside supported range');if(integer){let [mantissa,exp='0']=s.toLowerCase().replace(/^\+/,'').split('e'),[a,b='']=mantissa.split('.');let shift=Number(exp)-b.length;check(shift>=0||/^[0]*$/.test((a+b).slice(shift)),'Expected exact whole number');}return n;};
export async function build(files, options, load, validate){
 check(files.length,'Choose CSV files');let sources=[],rows=[],templates={},native_templates={},names=new Set(),errors=[];
 const core='batch_id line_id service label region sku os quantity hours_per_month pricing_option term storage_size_gib notes'.split(' ');
 for(const f of files){check(!names.has(f.name),'Duplicate filename '+f.name);names.add(f.name);let data=effective(f), parsed=parseCSV(data),native=parsed.headers.some(k=>k.startsWith('config.'));
 sources.push({file:f.name,sha256:await digest(encode(data)),bytes:encode(data).length,rows:parsed.records.length});
 for(const record of parsed.records){try{let raw=Object.fromEntries(parsed.headers.map((h,i)=>[h,record.cells[i].trim()]));let r={batch_id:raw.batch_id,line_id:raw.line_id,label:raw.label,notes:raw.notes,source_row:record.line,source_file:f.name};
 if(native){let t=native_templates[raw.service] ||= await load('native',raw.service);let headers=['batch_id','line_id','service','label','notes',...Object.keys(t.configuration).map(k=>'config.'+k)];check(headers.length===parsed.headers.length&&headers.every(k=>parsed.headers.includes(k)),'Retain every native config column');r.format='native';r.service=raw.service;r.notes=record.cells[parsed.headers.indexOf('notes')];r.configuration=Object.fromEntries(Object.entries(t.configuration).map(([k,v])=>[k,typeof v==='string'?nativeString(raw['config.'+k]):strictJSON(raw['config.'+k])]));
 }else{check(core.every(k=>parsed.headers.includes(k))&&parsed.headers.every(k=>[...core,'license','linux_type','redundancy'].includes(k)),'Friendly CSV columns differ');r.service=raw.service.toLowerCase();check(['virtual-machines','managed-disks'].includes(r.service),'Unsupported friendly service');r.region=raw.region;r.sku=raw.sku;check(raw.pricing_option.toLowerCase()==='payg'&&!raw.term,'Use payg with empty term');r.pricing_option='payg';r.quantity=number(raw.quantity,true,1,Number.MAX_SAFE_INTEGER);
 if(r.service==='virtual-machines'){r.hours=number(raw.hours_per_month,false,0,744);check(!raw.storage_size_gib&&!raw.redundancy,'Use separate disk rows');let os=raw.os.toLowerCase();if(['linux','ubuntu'].includes(os)){check((raw.linux_type||options.linux||(os==='ubuntu'?'ubuntu':''))==='ubuntu'&&!raw.license,'Choose Ubuntu explicitly');r.os='linux';r.os_type='ubuntu';r.license='';}else{check(os==='windows'&&(raw.license||options.license)==='included'&&!raw.linux_type,'Choose Windows licence included explicitly');r.os='windows';r.os_type='os-only';r.license='included';}}
 else{check(!raw.os&&!raw.hours_per_month&&!raw.license&&!raw.linux_type,'Disk OS/hours/licensing must be empty');r.storage_size_gib=number(raw.storage_size_gib,true,1,Number.MAX_SAFE_INTEGER);r.redundancy=raw.redundancy||options.redundancy;}
 templates[r.service] ||= await load('friendly',r.service);
 }
 r.custom_name=`[${files.length>1?f.name+':':''}${r.batch_id}/${r.line_id}] ${r.label}`;rows.push(r);
 }catch(e){errors.push({file:f.name,row:record.line,message:e.message});}}
 }
 const job={format:'calcbridge-job/v3',run_id:options.runId,currency:options.currency,pricing_context:'public',support:'basic',templates,native_templates,sources,source_sha256:await digest(encode(files.length===1?effective(files[0]):canonical(sources))),loading:{chunk_size:options.chunk||50,max_attempts:options.attempts||3,initial_backoff_ms:1000,max_backoff_ms:30000},estimate:{name:options.name||'CSV-'+options.runId,rows}};
 if(!errors.length){for(const row of rows){try{validate({...job,estimate:{...job.estimate,rows:[row]}});}catch(e){errors.push({file:row.source_file,row:row.source_row,message:e.message});}}}
 if(!errors.length){try{validate(job);}catch(e){errors.push({message:e.message});}}
 return {job,errors};
}
export function audit(files){return files.map(f=>{const original=parseCSV(f.original);return {file:f.name,original_sha256:f.originalHash,edits:f.records.flatMap((r,i)=>r.cells.flatMap((v,c)=>v===original.records[i].cells[c]?[]:[{original_row:original.records[i].line,field:f.headers[c],before:original.records[i].cells[c],after:v}]))};});}
