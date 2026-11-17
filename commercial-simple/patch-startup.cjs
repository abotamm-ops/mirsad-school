/* The saved scoped timetable is authoritative; a viewer tab is a fallback only. */
const fs=require('node:fs'),path=require('node:path');
const babel=require(path.join(path.dirname(require.resolve('playwright')),'lib/transform/babelBundle.js'));
const file=process.argv[2];let changed=0;
const plugin=({types:t})=>({visitor:{FunctionDeclaration(p){if(p.node.id?.name!=='startMonitoring')return;p.traverse({VariableDeclaration(v){const declarations=v.node.declarations;if(declarations.length!==3)return;const [tab,cache,snapshot]=declarations;if(!t.isAwaitExpression(tab.init)||!t.isCallExpression(tab.init.argument)||!t.isIdentifier(tab.init.argument.callee,{name:'getScheduleTab'}))return;
 tab.init=t.conditionalExpression(t.cloneNode(snapshot.id),t.nullLiteral(),tab.init);v.node.declarations=[cache,snapshot,tab];changed++}})}}});
module.exports=plugin;
if(require.main===module){
const input=fs.readFileSync(file,'utf8'),result=babel.babelTransform(input,file,false,[[__filename,{}]],[]);if(changed!==1)throw Error('Expected one cached schedule startup gate; found '+changed);fs.writeFileSync(file,result.code);console.log('Startup uses the saved timetable before querying viewer tabs.');

}
