using System;
using System.Collections.Generic;
using System.Threading;
using System.Windows.Automation;
public sealed class MirsadWindowTabs {
public long Handle;
public bool Reliable;
public bool Dashboard;
public bool Madrasati;
}
public static class MirsadChromeTabs {
public static long GuardHandle;
static readonly object gate=new object();
static MirsadWindowTabs[] snapshot=new MirsadWindowTabs[0];
static bool busy;
static DateTime updated=DateTime.MinValue;
public static DateTime UpdatedUtc { get { lock(gate) return updated; } }
public static MirsadWindowTabs[] Snapshot() { lock(gate) return (MirsadWindowTabs[])snapshot.Clone(); }
public static string TitlePrefix="";
public static bool DashboardTitle(string name) { return TitlePrefix.Length>0 && name!=null && name.Trim().StartsWith(TitlePrefix,StringComparison.Ordinal); }
public static MirsadWindowTabs Inspect(IntPtr handle) {
var result=new MirsadWindowTabs { Handle=handle.ToInt64() };
try {
var root=AutomationElement.FromHandle(handle);
if(root==null)return result;
var queue=new Queue<Tuple<AutomationElement,int>>();
queue.Enqueue(Tuple.Create(root,0));
int visited=0; bool sawTabs=false, truncated=false;
AutomationElement dashboard=null,teams=null;
while(queue.Count>0 && visited<1800) {
var entry=queue.Dequeue(); visited++;
var current=entry.Item1.Current;
if(current.ControlType==ControlType.TabItem) {
sawTabs=true;
if(DashboardTitle(current.Name)){result.Dashboard=true;dashboard=entry.Item1;}
else if((current.Name??"").IndexOf("Teams",StringComparison.OrdinalIgnoreCase)>=0 || (current.Name??"").Contains("تيمز"))teams=entry.Item1;
if((current.Name??"").Contains("مدرستي")) result.Madrasati=true;
continue;
}
if(current.ControlType==ControlType.Document)continue;
if(entry.Item2>=16) { truncated=true; continue; }
var children=entry.Item1.FindAll(TreeScope.Children,Condition.TrueCondition);
foreach(AutomationElement child in children) queue.Enqueue(Tuple.Create(child,entry.Item2+1));
}
result.Reliable=result.Dashboard || (sawTabs && !truncated && queue.Count==0);
if(dashboard!=null && teams!=null && Interlocked.Read(ref GuardHandle)==handle.ToInt64()){
object d,t;
if(dashboard.TryGetCurrentPattern(SelectionItemPattern.Pattern,out d) && ((SelectionItemPattern)d).Current.IsSelected && teams.TryGetCurrentPattern(SelectionItemPattern.Pattern,out t) && Interlocked.Read(ref GuardHandle)==handle.ToInt64())((SelectionItemPattern)t).Select();
}
} catch { result.Reliable=false; }
return result;
}
public static void Request(IntPtr[] handles) {
lock(gate) { if(busy || DateTime.UtcNow-updated<TimeSpan.FromSeconds(2)) return; busy=true; }
var copy=(IntPtr[])handles.Clone();
var worker=new Thread(()=>{
try {
var next=new List<MirsadWindowTabs>();
foreach(var handle in copy)next.Add(Inspect(handle));
lock(gate) { snapshot=next.ToArray(); updated=DateTime.UtcNow; }
} finally { lock(gate)busy=false; }
});
worker.IsBackground=true; worker.SetApartmentState(ApartmentState.MTA); worker.Start();
}
}

namespace System.Windows.Automation {
 public class ControlType {public static readonly ControlType TabItem=new ControlType(),Document=new ControlType(),Window=new ControlType();}
 public enum TreeScope {Children}
 public class Condition {public static readonly Condition TrueCondition=new Condition();}
 public class SelectionItemPattern {
  public static readonly object Pattern=new object(); public bool Selected;public int Calls;
  public Info Current {get{return new Info {IsSelected=Selected};}}
  public struct Info {public bool IsSelected;}
  public void Select(){Calls++;Selected=true;}
 }
 public class AutomationElement {
  public static AutomationElement Root;
  public class Info {public ControlType ControlType;public string Name;}
  public Info Current=new Info {ControlType=ControlType.Window,Name=""};
  public SelectionItemPattern Selection=new SelectionItemPattern();
  public System.Collections.Generic.List<AutomationElement> Children=new System.Collections.Generic.List<AutomationElement>();
  public static AutomationElement FromHandle(System.IntPtr h){return Root;}
  public System.Collections.Generic.List<AutomationElement> FindAll(TreeScope t,Condition c){return Children;}
  public bool TryGetCurrentPattern(object p,out object result){result=Selection;return true;}
 }
}
public static class TabsTest {
 static System.Windows.Automation.AutomationElement Tab(string name,bool selected){return new System.Windows.Automation.AutomationElement {Current=new System.Windows.Automation.AutomationElement.Info {ControlType=System.Windows.Automation.ControlType.TabItem,Name=name},Selection=new System.Windows.Automation.SelectionItemPattern {Selected=selected}};}
 public static string Run(){
  MirsadChromeTabs.TitlePrefix="مرصاد | الرصد الآلي";
  var d=Tab("مرصاد | الرصد الآلي",true);var t=Tab("Microsoft Teams",false);var other=Tab("Microsoft Teams - scan",false);
  var root=new System.Windows.Automation.AutomationElement();root.Children.Add(d);root.Children.Add(t);root.Children.Add(other);
  System.Windows.Automation.AutomationElement.Root=root;
  MirsadChromeTabs.GuardHandle=42;MirsadChromeTabs.Inspect((System.IntPtr)42);
  if(other.Selection.Calls!=1||t.Selection.Calls!=0)throw new System.Exception("Wrong Teams tab");
  d.Selection.Selected=false;MirsadChromeTabs.Inspect((System.IntPtr)42);if(other.Selection.Calls!=1)throw new System.Exception("Disturbed active scan");
  d.Selection.Selected=true;MirsadChromeTabs.GuardHandle=0;MirsadChromeTabs.Inspect((System.IntPtr)42);if(other.Selection.Calls!=1)throw new System.Exception("Pause ignored");
  MirsadChromeTabs.GuardHandle=43;MirsadChromeTabs.Inspect((System.IntPtr)42);if(other.Selection.Calls!=1)throw new System.Exception("Wrong workspace");
  root.Children.Remove(t);root.Children.Remove(other);MirsadChromeTabs.GuardHandle=42;var result=MirsadChromeTabs.Inspect((System.IntPtr)42);if(!result.Dashboard||!result.Reliable)throw new System.Exception("Missing Teams invalidates dashboard");
  return "PASS actual tab inspector: dashboard-to-Teams, rightmost scan tab, pause, other window, missing Teams";
 }
}
