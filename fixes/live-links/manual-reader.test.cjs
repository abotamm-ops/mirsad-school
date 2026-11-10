const fs=require('fs'),path=require('path'),{createRequire}=require('module');
const original=path.resolve('tests/live_link_refresh.test.cjs');
let code=fs.readFileSync(original,'utf8').replaceAll("fs.readFileSync('teams-probe/", "fs.readFileSync('/tmp/stable-link-Teams/");
code=code.replace("vm.runInContext(fs.readFileSync('/tmp/stable-link-Teams/drive-sync.js'","vm.runInContext(fs.readFileSync('/tmp/stable-link-Teams/schedule-core.js','utf8'),ctx);vm.runInContext(fs.readFileSync('/tmp/stable-link-Teams/drive-sync.js'");
Function('require',code)(createRequire(original));
