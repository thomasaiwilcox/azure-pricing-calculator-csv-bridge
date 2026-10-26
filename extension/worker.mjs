const allowed = url => {try{let u=new URL(url);return u.origin==='https://azure.microsoft.com'&&/^\/en-us\/pricing\/calculator\/?$/.test(u.pathname);}catch{return false;}};
chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
chrome.action.onClicked.addListener(tab=>{
 chrome.sidePanel.open({windowId:tab.windowId}).catch(console.error);
 chrome.storage.session.set({candidate:tab.id});
});
async function connect(){let {candidate}=await chrome.storage.session.get('candidate');if(!candidate)throw Error('Click the extension icon on the calculator tab first.');let tab=await chrome.tabs.get(candidate);if(!allowed(tab.url))throw Error('Open the English Azure calculator and click the extension icon there.');
 const [probe]=await chrome.scripting.executeScript({target:{tabId:candidate},world:'MAIN',func:()=>{globalThis.__CalcBridgeExtension=true;document.getElementById("calcbridge-panel")?.remove();return true;}});
 const target={tabId:candidate,documentIds:[probe.documentId]};
 await chrome.scripting.executeScript({target,world:'MAIN',files:['importer.js']});
 const [result]=await chrome.scripting.executeScript({target,world:'MAIN',func:()=>{try{AzureCalcBridge.connect();return {ok:true};}catch(e){return {error:e.message};}}});
 if(result.result.error)throw Error(result.result.error);
 const binding={tabId:candidate,documentId:probe.documentId};await chrome.storage.session.set({binding});return binding;
}
async function command(message){
 if(message.command==='open'){await chrome.tabs.create({url:'https://azure.microsoft.com/en-us/pricing/calculator/'});return 'Click the extension icon on the opened tab to connect.';}
 if(message.command==='connect')return connect();
 if(!['start','pause','resume','recheck','status','export'].includes(message.command))throw Error('Unknown command');
 let {binding}=await chrome.storage.session.get('binding');if(!binding)throw Error('Connect a calculator tab first.');
 let tab=await chrome.tabs.get(binding.tabId);if(!allowed(tab.url))throw Error('Calculator tab navigated away. Reconnect before continuing.');
 const [result]=await chrome.scripting.executeScript({target:{tabId:binding.tabId,documentIds:[binding.documentId]},world:'MAIN',func:(action,job,confirmed)=>{
  const api=globalThis.AzureCalcBridge;if(!api)return {error:'Reconnect the calculator.'};
  try{
   if(action==='status')return api.getStatus();
   if(action==='pause'){api.pause();return api.getStatus();}
   if(api.getStatus().busy)throw Error('An operation is already running.');
   if(['start','resume'].includes(action)){if(confirmed!==true)throw Error('Review and confirm this job first.');api.validateJob(job);void api.importJob(job,{confirm:()=>true}).catch(()=>{});}
   if(action==='recheck')void api.verifyCurrent(job).catch(e=>{globalThis.__AzureCalcBridgeRuntimeV2.message=e.message;});
   if(action==='export')void api.exportCurrent().catch(()=>{});
   return api.getStatus();
  }catch(e){return {error:e.message};}
 },args:[message.command,message.job||null,message.confirmed===true]});
 if(!result)throw Error('Document changed. Reconnect and reconcile the original job.');if(result.result.error)throw Error(result.result.error);return result.result;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('panel.html'))return false;
 command(message).then(value=>reply({value})).catch(error=>reply({error:error.message}));return true;
});
