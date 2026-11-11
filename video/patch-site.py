from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
for prefix in ['', 'schools/']:
 p=root/(prefix+'monitoring.js');s=p.read_text();marker='// Mirsad video cell controls v1'
 if marker not in s:s+='\n'+marker+"\n{const renderBeforeVideo=renderTable;renderTable=function(target,data){renderBeforeVideo(target,data);globalThis.MirsadVideoUI?.mount(target,data,{call:api})}}\n"
 p.write_text(s)
 p=root/(prefix+'automatic-monitoring.html');s=p.read_text();base='../video/' if prefix else 'video/'
 if base+'ui.js' not in s:
  pattern=r'(<script[^>]*src="monitoring\.js[^\"]*"[^>]*></script>)'
  extra='<link rel="stylesheet" href="'+base+'ui.css?v=video1"><script src="'+base+'ui.js?v=video1" defer></script>'
  s,count=re.subn(pattern,lambda m:extra+m.group(1),s,count=1);assert count==1,p
 p.write_text(s)
