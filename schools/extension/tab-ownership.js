/* Only extension-created work tabs may be reused or closed. Never borrow user tabs. */
var MirsadTabOwnership=(()=>{
 const owned=new Map(),session=chrome.storage.session,prefix='mirsadOwnedWorkTab:';
 async function kind(id){if(!Number.isInteger(id))return null;if(owned.has(id))return owned.get(id);if(session){const s=await session.get(prefix+id);if(s[prefix+id]){owned.set(id,s[prefix+id]);return s[prefix+id]}}return null}
 async function claim(tab,type){if(!Number.isInteger(tab?.id))throw Error('تعذر تحديد تبويب العمل');owned.set(tab.id,type);if(session)await session.set({[prefix+tab.id]:type});return tab}
 async function forget(id){owned.delete(id);if(session)await session.remove(prefix+id)}
 function probeUrl(value){if(value==='about:blank')return true;try{const u=new URL(value);return u.protocol==='https:'&&['teams.microsoft.com','teams.live.com','login.microsoftonline.com','login.live.com'].includes(u.hostname)}catch{return false}}
 function collectorUrl(value){try{const u=new URL(value);return u.origin==='https://schools.madrasati.sa'&&(/^\/SchoolManagment\/Lessons\/TimeTable\/[a-f0-9]+\/?$/i.test(u.pathname)||/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i.test(u.pathname))}catch{return false}}
 function allowed(tab,type){const urls=[tab.url,tab.pendingUrl].filter(Boolean);return urls.length>0&&urls.every(type==='probe'?probeUrl:collectorUrl)}
 async function reusable(tab){return await kind(tab?.id)==='probe'&&allowed(tab,'probe')}
 async function close(id,type){if(await kind(id)!==type)return false;let tab;try{tab=await chrome.tabs.get(id)}catch{await forget(id);return false}if(!allowed(tab,type)){await forget(id);return false}await chrome.tabs.remove(id);await forget(id);return true}
 async function popup(tab,parent){if(!Number.isInteger(tab?.id)||tab.openerTabId!==parent||await kind(parent)!=='probe'||!allowed(tab,'probe'))return false;await claim(tab,'probe');return true}
 chrome.tabs.onRemoved?.addListener(id=>{void forget(id).catch(()=>{})});
 return {reusableCollector:async tab=>await kind(tab?.id)==='collector'&&allowed(tab,'collector'),claimProbe:tab=>claim(tab,'probe'),claimCollector:tab=>claim(tab,'collector'),reusable,closeProbe:id=>close(id,'probe'),closeCollector:id=>close(id,'collector'),popup};
})();
