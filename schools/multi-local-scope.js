/* Signatures and hidden-letter preferences belong to a school, not just its subscription. */
(()=>{'use strict';const view=()=>globalThis.MirsadSchoolViewScope?.()||{account:'',id:'unselected',legacy:false};
 const signature=globalThis.MirsadDirectorSignature;if(signature){const original=signature.setScope.bind(signature);signature.setScope=source=>original(()=>{const base=typeof source==='function'?source():String(source||''),site=view();return site.legacy?base:base+'|school:'+(site.localId||site.id)});}
 const list=globalThis.MirsadLetterList;if(list)for(const [method,index]of [['visible',1],['remove',1],['restore',0],['count',0]]){const original=list[method];list[method]=(...args)=>{const site=view();if(site.multi===false)return original(...args);args[index]=String(args[index]||'')+'|account:'+site.account+'|school:'+(site.localId||site.id);return original(...args)}}
})();
