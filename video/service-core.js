/* Queue owns video metadata only. Caller authenticates writer/admin and scopes storage. */
function createMirsadVideoService(env){
 const now=env.now,load=()=>env.load()||{revision:0,configs:[],jobs:[]},save=env.save;
 const publicJob=j=>{const {lease,uploadSession,url,...rest}=j;return rest};
 const view=s=>({supported:true,canManage:env.admin,serverTime:now(),revision:s.revision,generation:s.generation||0,configs:s.configs,jobs:s.jobs.map(publicJob),device:env.deviceRead()});
 const requireAdmin=()=>{if(!env.admin)throw Error('التسجيل يتطلب دخول إدارة الموقع')};
 const requireWriter=()=>{if(!env.writer)throw Error('التسجيل يتطلب جهاز الرصد المرتبط')};
 function currentJob(s,input){const j=s.jobs.find(j=>j.id===input.id);if(!j||j.lease!==input.lease)throw Error('جلسة فيديو غير صالحة');return j}
 return {request(action,p){
  if(!env.admin&&!env.writer)throw Error('دخول غير مصرح لتسجيل الفيديو');const s=load();
  if(action==='videoStatus')return view(s);
  if(action==='videoConfigure'){
   requireAdmin();if(p.expectedRevision!==s.revision)throw Error('تغير اختيار التسجيل؛ أعد فتح إعداداته');
   const snap=env.snapshot();if(p.scheduleRevision!==snap.scheduleRevision)throw Error('تغير جدول الحصص؛ حدّث الجدول');
   const lesson=snap.lessons.find(l=>l.teacherId===p.teacherId&&Number(l.period)===Number(p.period));if(!lesson?.url)throw Error('لا يوجد رابط صالح للحصة المطلوبة');
   const config=MirsadVideoCore.settings({teacherId:lesson.teacherId,teacherName:lesson.teacherName,period:Number(lesson.period),minutes:p.minutes,cycles:p.cycles,scheduleRevision:snap.scheduleRevision},snap.roundCount);
   if(config.enabled)s.configs=s.configs.map(c=>{if(c.teacherId===config.teacherId||c.period!==config.period)return c;const cycles=c.cycles.filter(n=>!config.cycles.includes(n));return {...c,cycles,enabled:cycles.length>0}}).filter(c=>c.teacherId===config.teacherId||c.period!==config.period||c.cycles.length>0);
   const old=s.configs.findIndex(c=>c.teacherId===config.teacherId&&c.period===config.period);if(old<0){if(s.configs.length>=100)throw Error('وصلت اختيارات التسجيل إلى الحد الأقصى');s.configs.push(config)}else s.configs[old]=config;
   s.revision++;save(s);return {...view(s),saved:true};
  }
  if(action==='videoPoll'){
   requireWriter();env.deviceWrite({ready:p.ready===true,at:now(),sessionId:String(p.sessionId||'').slice(0,80),resetPendingDates:Array.isArray(p.resetPendingDates)?p.resetPendingDates.filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0,200):[]});
   let changed=false;for(const job of s.jobs)if(['joining','recording'].includes(job.phase)&&now()>=job.deadline){job.phase='failed';job.error='انتهى فاصل التسجيل؛ الرصد له الأولوية';job.updatedAt=now();changed=true}
   if(changed)save(s);
   const active=s.jobs.find(j=>['joining','recording'].includes(j.phase));if(active){const selected=s.configs.find(c=>c.teacherId===active.teacherId&&c.period===active.period&&c.scheduleRevision===active.scheduleRevision&&c.enabled&&c.cycles.includes(active.afterCycle));if(!selected){active.phase='failed';active.error='أُلغي اختيار التسجيل';active.updatedAt=now();save(s);return {job:null,cancelled:active.id,serverTime:now()}}if(p.ready&&p.recordingId===active.id&&p.gap?.key===active.gapKey){active.updatedAt=now();save(s)}return {job:{...active},serverTime:now()};}
   if(p.ready!==true||!p.gap||!Number.isFinite(p.gap.nextCycleAt))return {job:null,serverTime:now()};
   const g=p.gap;if(typeof g.key!=='string'||!g.key||g.key.length>200||!Number.isInteger(g.period)||g.period<1||g.period>7||g.deadline!==g.nextCycleAt-30000||g.deadline-now()<5000||g.deadline-now()>12*60*60*1000||![1,2,3].includes(g.afterCycle))return {job:null,serverTime:now()};
   const snap=env.snapshot();if(g.afterCycle>snap.roundCount)return {job:null,serverTime:now()};
   const config=s.configs.find(c=>c.enabled&&c.period===g.period&&c.cycles.includes(g.afterCycle)&&c.scheduleRevision===snap.scheduleRevision);
   if(!config||s.jobs.some(j=>j.gapKey===g.key))return {job:null,serverTime:now()};
   if(s.jobs.length>=100)throw Error('وصلت تسجيلات اليوم إلى الحد الأقصى');
   const lesson=snap.lessons.find(l=>l.teacherId===config.teacherId&&Number(l.period)===config.period);if(!lesson?.url)return {job:null,serverTime:now()};
   const job={generation:s.generation||0,id:env.id(),lease:env.id(),date:env.date,teacherId:config.teacherId,teacherName:config.teacherName,period:config.period,afterCycle:g.afterCycle,minutes:config.minutes,deadline:g.deadline,gapKey:g.key,scheduleRevision:snap.scheduleRevision,url:lesson.url,phase:'joining',createdAt:now(),updatedAt:now(),localSaved:false,driveSaved:false};s.jobs.push(job);save(s);return {job,serverTime:now()};
  }
  requireWriter();const j=currentJob(s,p);
  if(action==='videoUpdate'){
   if(!['joining','recording','saving','uploading','saved','failed'].includes(p.phase))throw Error('حالة فيديو غير صالحة');
   if(p.phase==='recording'&&(now()>=j.deadline||!['joining','recording'].includes(j.phase)))throw Error('لا يجوز التسجيل بعد انتهاء الفاصل');
   // Terminal capture failures cannot be turned into a successful recording by a late event.
   if(j.phase==='failed'&&p.phase==='recording')throw Error('جلسة التسجيل منتهية');
   if(j.driveSaved&&p.phase!=='failed')j.phase=j.localSaved||p.localSaved===true?'completed':'saved';else j.phase=p.phase;
   if(p.localSaved===true)j.localSaved=true;if(p.diskSaved===true){j.diskSaved=true;j.diskPaths=Array.isArray(p.diskPaths)?p.diskPaths.filter(x=>typeof x==='string').map(x=>x.slice(0,700)).slice(0,3):[]}if(typeof p.diskError==='string')j.diskError=p.diskError.slice(0,500);
   if(Number.isFinite(p.durationMs))j.durationMs=Math.max(0,Math.min(600000,p.durationMs));
   if(p.error)j.error=String(p.error).slice(0,500);j.updatedAt=now();save(s);return {saved:true,job:publicJob(j)};
  }
  if(action==='videoUploadBegin'){
   if(!['saving','uploading','saved'].includes(j.phase))throw Error('الفيديو ليس جاهزًا للرفع');
   if(!Number.isInteger(p.size)||p.size<1||p.size>200*1024*1024||!/^video\/webm(?:;.*)?$/.test(p.mime||''))throw Error('ملف فيديو غير صالح');
   if(j.driveSaved)return {complete:true,job:publicJob(j)};
   if(j.size&&j.size!==p.size)throw Error('تغير حجم ملف التسجيل');j.size=p.size;j.mime=p.mime;
   if(!j.uploadSession)j.uploadSession=env.uploadBegin(j);
   j.phase='uploading';save(s);return {uploadSession:j.uploadSession};
  }
  if(action==='videoUploadFinish'){
   if(j.driveSaved)return {saved:true,job:publicJob(j)};
   const file=env.uploadVerify(j,String(p.fileId||''));if(!file?.url)throw Error('لم يتأكد حفظ الفيديو في Drive');j.driveSaved=true;j.driveUrl=file.url;j.phase=j.localSaved?'completed':'saved';delete j.uploadSession;j.updatedAt=now();save(s);return {saved:true,job:publicJob(j)};
  }
  throw Error('طلب تسجيل غير مدعوم');
 }};
}
