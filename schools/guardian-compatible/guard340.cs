using System;
public static class GuardTest {
static IntPtr Foreground,Panel=(IntPtr)2,Chrome=(IntPtr)1;
static bool Valid=true,Iconic,Zoomed=true,Attached;
static int Maximizes,Focus,Detached;
static bool IsWindow(IntPtr h){return Valid;}
static bool IsIconic(IntPtr h){return Iconic;}
static bool IsZoomed(IntPtr h){return Zoomed;}
static bool ShowWindowAsync(IntPtr h,int n){if(n!=3)throw new Exception("Not maximized");Maximizes++;return true;}
static bool SetWindowPos(IntPtr h,IntPtr a,int x,int y,int w,int ht,uint flags){return true;}
static IntPtr GetForegroundWindow(){return Foreground;}
static uint GetWindowThreadProcessId(IntPtr h,out uint p){p=1;return 2;}
static uint GetCurrentThreadId(){return 1;}
static bool AttachThreadInput(uint a,uint b,bool v){Attached=v;if(!v)Detached++;return true;}
static bool BringWindowToTop(IntPtr h){return true;}
static bool SetForegroundWindow(IntPtr h){Focus++;return true;}
static bool IsWindowVisible(IntPtr h){return true;}
public static void KeepWorkspace(IntPtr hwnd,IntPtr panel){
 if(!IsWindow(hwnd))return;
 if(IsIconic(hwnd)||!IsZoomed(hwnd))ShowWindowAsync(hwnd,3);
 SetWindowPos(hwnd,new IntPtr(-1),0,0,0,0,0x13);
 var foreground=GetForegroundWindow();
 if(foreground!=panel && foreground!=hwnd){
  uint pid;var tid=GetWindowThreadProcessId(foreground,out pid);var own=GetCurrentThreadId();
  bool attached=tid!=0&&tid!=own&&AttachThreadInput(own,tid,true);
  try{BringWindowToTop(hwnd);SetForegroundWindow(hwnd);}finally{if(attached)AttachThreadInput(own,tid,false);}
 }
 if(IsWindowVisible(panel))SetWindowPos(panel,new IntPtr(-1),0,0,0,0,0x13);
}

static void Reset(){Valid=true;Iconic=false;Zoomed=true;Maximizes=Focus=Detached=0;Attached=false;Foreground=(IntPtr)3;}
public static string Run(){
Reset();Iconic=true;KeepWorkspace(Chrome,Panel);if(Maximizes!=1||Focus!=1||Attached||Detached!=1)throw new Exception("Minimized recovery failed");
Reset();Zoomed=false;KeepWorkspace(Chrome,Panel);if(Maximizes!=1)throw new Exception("Resized recovery failed");
Reset();Foreground=Panel;KeepWorkspace(Chrome,Panel);if(Focus!=0)throw new Exception("Panel unusable");
Reset();Foreground=Chrome;KeepWorkspace(Chrome,Panel);if(Focus!=0||Maximizes!=0)throw new Exception("Active scan disturbed");
Reset();Valid=false;KeepWorkspace(Chrome,Panel);if(Focus!=0||Maximizes!=0)throw new Exception("Closed handle used");
return "PASS five real guard-method scenarios: minimized, resized, covering app, panel, closed handle";
}}
