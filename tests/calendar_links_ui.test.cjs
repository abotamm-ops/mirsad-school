const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../teams-probe/schedule-core.js');
const ui=require('../calendar-links-ui.js'),url='https://teams.microsoft.com/l/meetup-join/meeting';
test('lesson links keep Madrasati primary and show only a different canonical calendar meeting',()=>{
 assert.deepEqual(ui.links({url,calendarUrl:url+'?context=other#join'}),[{source:'madrasati',label:'مدرستي',url}]);
 const calendarUrl='https://teams.microsoft.com/meet/123?p=secret';
 assert.deepEqual(ui.links({url,calendarUrl}).map(x=>[x.source,x.label]),[['madrasati','مدرستي'],['calendar','تقويم تيمز']]);
 assert.deepEqual(ui.links({url:'',calendarUrl}).map(x=>x.source),['calendar']);
 assert.deepEqual(ui.links({url:'javascript:alert(1)',calendarUrl:'https://evil.example/meet/123'}),[]);
 const wrapped='https://teams.microsoft.com/dl/launcher/launcher.html?url='+encodeURIComponent('/_#/l/meetup-join/meeting?web=1');
 assert.equal(ui.links({url,calendarUrl:wrapped}).length,1);
 assert.equal(ui.meetingKey(url.replace('/meeting','/%6Deeting')),ui.meetingKey(url));
});
test('a present cycle keeps absent child proof available once and rejects unsafe evidence URLs',()=>{
 const proof='https://drive.google.com/file/d/calendar-proof/view',child={scanId:'child',source:'calendar',url,status:'absent',evidenceUrl:proof,scannedAt:10};
 const result=ui.evidence({evidence:[{...child,cycle:1}],history:[{scanId:'cycle',cycle:1,status:'present',linkResults:[child,{...child,evidenceUrl:'javascript:alert(1)'},{...child,evidenceUrl:'https://evil.example/file/d/fake/view'}]}]});
 assert.equal(result.length,1);assert.equal(result[0].source,'calendar');assert.equal(result[0].cycle,1);assert.equal(result[0].evidenceUrl,proof);
 assert.equal(ui.evidence({history:[{cycle:1,status:'present',evidenceUrl:proof}]}).length,0);
});
test('school and original UI modules stay identical',()=>{
 assert.equal(fs.readFileSync('schools/calendar-links-ui.js','utf8'),fs.readFileSync('calendar-links-ui.js','utf8'));
});
