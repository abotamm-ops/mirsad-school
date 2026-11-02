/* Hand-drawn director signature, scoped to this service and browser. */
(function(root){'use strict';let scope=()=>'';
const valid=value=>typeof value==='string'&&value.length<1000000&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(value);
const key=()=> 'mirsad_director_signature_v1:'+scope();
const api={setScope(provider){scope=typeof provider==='function'?provider:()=>String(provider||'')},get(){try{const value=localStorage.getItem(key());return valid(value)?value:''}catch{return ''}},save(value){if(!valid(value))throw new Error('التوقيع غير صالح');localStorage.setItem(key(),value)},remove(){localStorage.removeItem(key())}};
root.MirsadDirectorSignature=api;
if(typeof document==='undefined')return;
function init(){const canvas=document.getElementById('directorSignatureCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),feedback=document.getElementById('directorSignatureFeedback');let drawing=false,hasInk=false,dirty=false,generation=0;
function signatureImage(){const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,top=canvas.height,right=-1,bottom=-1;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}if(right<left)throw new Error('empty');const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const width=right-left+1,height=bottom-top+1,scale=Math.min(out.width*.9/width,out.height*.8/height);out.getContext('2d').drawImage(canvas,left,top,width,height,(out.width-width*scale)/2,(out.height-height*scale)/2,width*scale,height*scale);return out.toDataURL('image/png')}
function stop(){drawing=false}
function clear(){generation++;ctx.clearRect(0,0,canvas.width,canvas.height);hasInk=false;dirty=true}
function load(){clear();dirty=false;const saved=api.get();if(!saved)return;const version=generation,img=new Image();img.onload=()=>{if(version!==generation||dirty)return;ctx.drawImage(img,0,0,canvas.width,canvas.height);hasInk=true};img.src=saved}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height}}
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();generation++;drawing=true;dirty=true;hasInk=true;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.strokeStyle='#12293a';ctx.fillStyle='#12293a';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.arc(p.x,p.y,1.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(p.x,p.y);feedback.textContent='توقيع غير محفوظ؛ اضغط حفظ التوقيع.'});
canvas.addEventListener('pointermove',e=>{if(!drawing)return;e.preventDefault();const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke()});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,stop);
document.getElementById('saveDirectorSignature').onclick=()=>{if(!hasInk){feedback.textContent='ارسم توقيع المدير أولًا.';return}try{api.save(signatureImage());dirty=false;feedback.textContent='حُفظ توقيع المدير على هذا المتصفح؛ سيظهر في التقارير الجديدة.'}catch{feedback.textContent='تعذر حفظ التوقيع على هذا المتصفح؛ لم يُحدّث التوقيع المحفوظ.'}};
document.getElementById('clearDirectorSignature').onclick=()=>{stop();clear();feedback.textContent='مُسح الرسم؛ التوقيع المحفوظ لم يتغير.'};
document.getElementById('deleteDirectorSignature').onclick=()=>{try{api.remove();stop();clear();dirty=false;feedback.textContent='حُذف التوقيع المحفوظ؛ التقارير الجديدة بلا توقيع.'}catch{feedback.textContent='تعذر حذف التوقيع المحفوظ.'}};
load();document.getElementById('directorSignaturePanel').addEventListener('toggle',()=>{if(!dirty&&!drawing)load()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(globalThis);
