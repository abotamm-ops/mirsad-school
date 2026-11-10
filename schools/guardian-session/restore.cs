[StructLayout(LayoutKind.Sequential)] public struct RestoreKey { public ushort Vk,Scan; public uint Flags,Time; public UIntPtr Extra; }
[StructLayout(LayoutKind.Explicit,Size=32)] public struct RestoreUnion { [FieldOffset(0)] public RestoreKey Keyboard; }
[StructLayout(LayoutKind.Sequential)] public struct RestoreInput { public uint Type; public RestoreUnion Data; }
[DllImport("user32.dll")] static extern uint SendInput(uint count,RestoreInput[] inputs,int size);
[DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
static RestoreInput Key(ushort vk,uint flags){return new RestoreInput{Type=1,Data=new RestoreUnion{Keyboard=new RestoreKey{Vk=vk,Flags=flags}}};}
public static bool RestoreTabs(IntPtr hwnd){
if(!IsWindow(hwnd)||GetForegroundWindow()!=hwnd)return false;
foreach(int k in new[]{16,17,18,91,92})if((GetAsyncKeyState(k)&0x8000)!=0)return false;
var keys=new[]{Key(17,0),Key(16,0),Key(84,0),Key(84,2),Key(16,2),Key(17,2)};
uint sent=SendInput((uint)keys.Length,keys,Marshal.SizeOf(typeof(RestoreInput)));
if(sent!=(uint)keys.Length){var release=new[]{Key(16,2),Key(17,2)};SendInput(2,release,Marshal.SizeOf(typeof(RestoreInput)));}
return sent>0;
}
