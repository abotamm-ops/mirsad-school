/* Bound read-only content-script messages; never replay a service write. */
var MirsadPageRead=async function(read,timeout=4000){let timer;try{return await Promise.race([Promise.resolve().then(read),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('لم تستجب صفحة مدرستي للقراءة'),{mirsadReadFailure:true})),timeout)})])}finally{clearTimeout(timer)}};
