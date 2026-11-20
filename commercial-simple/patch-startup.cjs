/* Preserve control epochs on a fresh run, and prefer the scoped saved timetable. */
const fs=require('node:fs'),path=require('node:path');
const babel=require(path.join(path.dirname(require.resolve('playwright')),'lib/transform/babelBundle.js'));
const changes={schedule:0,epoch:0,emptyStop:0};
const plugin=({types:t})=>{
 const name=node=>t.isIdentifier(node)?node.name:t.isStringLiteral(node)?node.value:null;
 return {visitor:{FunctionDeclaration(p){
  if(p.node.id?.name==='startMonitoring'){
   const epoch=p.scope.generateUidIdentifier('startupEpoch');
   const read=t.awaitExpression(t.callExpression(t.memberExpression(t.memberExpression(t.memberExpression(t.identifier('chrome'),t.identifier('storage')),t.identifier('local')),t.identifier('get')),[t.identifier('RUN_CONTROL_KEY')]));
   p.node.body.body.unshift(t.variableDeclaration('const',[t.variableDeclarator(t.cloneNode(epoch),t.logicalExpression('??',t.memberExpression(read,t.identifier('RUN_CONTROL_KEY'),true),t.numericLiteral(0)))]));
   p.traverse({
    VariableDeclaration(v){const d=v.node.declarations;if(d.length!==3)return;const [tab,cache,snapshot]=d;if(!t.isAwaitExpression(tab.init)||!t.isCallExpression(tab.init.argument)||!t.isIdentifier(tab.init.argument.callee,{name:'getScheduleTab'}))return;tab.init=t.conditionalExpression(t.cloneNode(snapshot.id),t.nullLiteral(),tab.init);v.node.declarations=[cache,snapshot,tab];changes.schedule++},
    ObjectProperty(v){if(name(v.node.key)!=='controlEpoch'||!t.isObjectExpression(v.parent))return;if(!v.parent.properties.some(k=>t.isObjectProperty(k)&&name(k.key)==='running'&&t.isBooleanLiteral(k.value,{value:true})))return;v.node.value=t.cloneNode(epoch);changes.epoch++}
   });
  }
  if(p.node.id?.name==='commitRunControl')p.traverse({IfStatement(v){const n=v.node;if(!t.isUnaryExpression(n.test,{operator:'!'})||!t.isMemberExpression(n.test.argument)||!t.isIdentifier(n.test.argument.property,{name:'KEY'})||!t.isReturnStatement(n.consequent)||!t.isNullLiteral(n.consequent.argument))return;
   const state=t.cloneNode(n.test.argument.object),value=t.binaryExpression('+',t.logicalExpression('??',t.memberExpression(state,t.identifier('RUN_CONTROL_KEY'),true),t.numericLiteral(0)),t.numericLiteral(1));
   n.consequent=t.blockStatement([t.expressionStatement(t.awaitExpression(t.callExpression(t.memberExpression(t.memberExpression(t.memberExpression(t.identifier('chrome'),t.identifier('storage')),t.identifier('local')),t.identifier('set')),[t.objectExpression([t.objectProperty(t.identifier('RUN_CONTROL_KEY'),value,true)])]))),t.returnStatement(t.nullLiteral())]);changes.emptyStop++
  }});
 }}};
};
module.exports=plugin;
if(require.main===module){const file=process.argv[2],input=fs.readFileSync(file,'utf8'),result=babel.babelTransform(input,file,false,[[__filename,{}]],[]);if(Object.values(changes).some(n=>n!==1))throw Error('Review startup gates: '+JSON.stringify(changes));fs.writeFileSync(file,result.code);console.log('Startup keeps the persisted control epoch; stop invalidates pending empty-run work; viewer is fallback only.');}
