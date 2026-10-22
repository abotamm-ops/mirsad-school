const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),create=require('./backend-fixture.cjs');
test('unified site password grants administration without a second PIN and rejects direct reader writes',()=>{
 const b=create(),date='2026-10-20';b.props.MONITOR_SITE_PASSWORD='fixture-site-password';
 b.write('startDay',{date,items:[{teacher:'معلم',period:1,url:''}],roundCount:3});
 assert.equal(b.api({action:'adminLogin',key:b.props.MONITOR_SITE_PASSWORD}).role,'admin');
 for(const key of ['',b.props.MONITOR_READER_KEY,b.props.MONITOR_API_KEY,'wrong'])assert.equal(b.api({action:'adminLogin',key}).ok,false);
 const teacherId=b.read('day',{date}).snapshot.teachers[0].id;
 const edit={action:'override',date,teacherId,period:1,status:'present',requestId:crypto.randomUUID()};
 assert.equal(b.api({...edit,key:b.props.MONITOR_SITE_PASSWORD}).ok,true);
 for(const key of ['',b.props.MONITOR_READER_KEY,b.props.MONITOR_API_KEY])assert.equal(b.api({...edit,key,adminPin:'111395',requestId:crypto.randomUUID()}).ok,false);
 assert.equal(b.api({...edit,audience:'teachers',key:b.props.MONITOR_SITE_PASSWORD}).ok,false);
 assert.equal(b.api({action:'day',date}).ok,false);
});
