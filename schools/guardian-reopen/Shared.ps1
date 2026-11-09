param([ValidatePattern('^(Default|Profile [0-9]+)$')][string]$Profile = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
public static class MirsadChromeWindow {
public delegate bool EnumProc(IntPtr hwnd, IntPtr param);
[DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
[DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int size);
[DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int size);
public static string TitlePrefix="";
public static bool IsMirsad(IntPtr hwnd) { var title = new StringBuilder(1024); GetWindowText(hwnd, title, title.Capacity); return TitlePrefix.Length>0 && title.ToString().Trim().StartsWith(TitlePrefix,StringComparison.Ordinal); }
[DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd, int mode);
[DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
[DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
public static void Pin(IntPtr hwnd) { if ((GetWindowLong(hwnd,-20) & 8)==0) SetWindowPos(hwnd,new IntPtr(-1),0,0,0,0,0x13); }
public static void Unpin(IntPtr hwnd) { if (IsWindow(hwnd)) SetWindowPos(hwnd,new IntPtr(-2),0,0,0,0,0x13); }
[DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
[DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
[DllImport("user32.dll")] static extern bool AttachThreadInput(uint a,uint b,bool attach);
[DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
[DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
[DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string c,string t);
public static bool Reveal(){var h=FindWindow(null,"مرصاد | مساعد الرصد");if(h==IntPtr.Zero)return false;ShowWindowAsync(h,9);SetForegroundWindow(h);SetWindowPos(h,new IntPtr(-1),0,0,0,0,0x13);return true;}
public static void FocusForOpen(IntPtr hwnd) { if(!IsWindow(hwnd))return; if(IsIconic(hwnd))ShowWindowAsync(hwnd,9); SetForegroundWindow(hwnd); }
[DllImport("user32.dll")] static extern bool ReleaseCapture();
[DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd, int message, IntPtr wparam, IntPtr lparam);
public static void Drag(IntPtr hwnd) { ReleaseCapture(); SendMessage(hwnd,0xA1,new IntPtr(2),IntPtr.Zero); }
[DllImport("user32.dll")] public static extern bool DestroyIcon(IntPtr icon);
[DllImport("kernel32.dll")] static extern uint SetThreadExecutionState(uint flags);
public static bool KeepAwake(bool enabled) { return SetThreadExecutionState(enabled ? 0x80000003u : 0x80000000u) != 0; }
public static IntPtr[] Windows() {
var found = new List<IntPtr>();
EnumWindows((hwnd, p) => {
if (!IsWindowVisible(hwnd)) return true;
var name = new StringBuilder(256); GetClassName(hwnd, name, name.Capacity);
if (name.ToString() != "Chrome_WidgetWin_1") return true;
uint pid; GetWindowThreadProcessId(hwnd, out pid);
try { if (Process.GetProcessById((int)pid).ProcessName.Equals("chrome", StringComparison.OrdinalIgnoreCase)) found.Add(hwnd); } catch {}
return true;
}, IntPtr.Zero);
return found.ToArray();
}
}
'@
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName WindowsBase
$uiaReferences = @([System.Windows.Automation.AutomationElement].Assembly.Location, [System.Windows.Automation.ControlType].Assembly.Location, [System.Windows.Rect].Assembly.Location, [System.Diagnostics.Process].Assembly.Location) | Select-Object -Unique
Add-Type -ReferencedAssemblies $uiaReferences -TypeDefinition @'
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
'@
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public sealed class MirsadHotkeys : IMessageFilter, IDisposable {
[DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
[DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window,int id);
public event EventHandler StartRequested;
public event EventHandler ExitRequested;
public event EventHandler PauseRequested;
bool registered;
public bool Register() {
if (!RegisterHotKey(IntPtr.Zero,902,0x4006,0x51)) return false;
RegisterHotKey(IntPtr.Zero,901,0x4006,0x4D);
RegisterHotKey(IntPtr.Zero,903,0x4006,0x50);
registered=true; Application.AddMessageFilter(this); return true;
}
public bool PreFilterMessage(ref Message message) {
if(message.Msg!=0x0312) return false;
if(message.WParam.ToInt32()==903) { if(PauseRequested!=null) PauseRequested(this,EventArgs.Empty); return true; }
if(message.WParam.ToInt32()==902) { if(ExitRequested!=null) ExitRequested(this,EventArgs.Empty); return true; }
if(message.WParam.ToInt32()==901) { if(StartRequested!=null) StartRequested(this,EventArgs.Empty); return true; }
return false;
}
public void Dispose() { if(!registered)return; registered=false; UnregisterHotKey(IntPtr.Zero,901); UnregisterHotKey(IntPtr.Zero,902); UnregisterHotKey(IntPtr.Zero,903); Application.RemoveMessageFilter(this); }
}
'@
function Get-MirsadProducts {
@(
[PSCustomObject]@{ Edition='Private'; Label='مرصاد الخاص'; ExtensionId='mdkhgdcnfibnemhiklpejojajjajhcbg'; Url='https://mirsad-school.onrender.com/automatic-monitoring.html?guardian=1'; Prefix='مرصاد | الرصد الآلي' },
[PSCustomObject]@{ Edition='Schools'; Label='مرصاد المدارس'; ExtensionId='ologpgneejnippbdhboiaaijpgkejcck'; Url='https://mirsad-school.onrender.com/schools/automatic-monitoring.html?guardian=1'; Prefix='مرصاد المدارس | الرصد الآلي' }
)
}
function Get-MirsadChoices {
param([string]$DataDir, [ValidateSet('Auto','Private','Schools')][string]$Edition='Auto', [string]$Profile='')
if (-not (Test-Path -LiteralPath $DataDir)) { return }
foreach ($folder in (Get-ChildItem -LiteralPath $DataDir -Directory | Sort-Object Name)) {
if ($folder.Name -ne 'Default' -and $folder.Name -notmatch '^Profile [0-9]+$') { continue }
if ($Profile -and $folder.Name -ne $Profile) { continue }
$installed=@{}; $display=$folder.Name
foreach ($name in @('Preferences','Secure Preferences')) {
try {
$settings=Get-Content -LiteralPath (Join-Path $folder.FullName $name) -Raw -Encoding UTF8 | ConvertFrom-Json
if ($settings.profile.name) { $display=[string]$settings.profile.name }
foreach ($product in (Get-MirsadProducts)) {
$entry=$settings.extensions.settings.PSObject.Properties[$product.ExtensionId]
if ($null -ne $entry) { $installed[$product.ExtensionId]=$entry.Value }
}
} catch {}
}
foreach ($product in (Get-MirsadProducts)) {
if ($Edition -ne 'Auto' -and $Edition -ne $product.Edition) { continue }
$entry=$installed[$product.ExtensionId]
if ($null -eq $entry) { continue }
if ($null -ne $entry.PSObject.Properties['state'] -and [int]$entry.state -ne 1) { continue }
[PSCustomObject]@{Edition=$product.Edition; Label=$product.Label; ExtensionId=$product.ExtensionId; Profile=$folder.Name; Url=$product.Url; Prefix=$product.Prefix; Display=($product.Label+' — '+$display+' ('+$folder.Name+')')}
}
}
}
function Select-MirsadChoice([object[]]$Choices){
if(!$Choices.Count){throw 'فعّل إضافة مرصاد في Chrome'}
if($Choices.Count -eq 1){return $Choices[0]}
$d=New-Object System.Windows.Forms.Form
$d.Text='اختر مرصاد';$d.ClientSize=New-Object System.Drawing.Size(520,130);$d.StartPosition='CenterScreen';$d.TopMost=$true;$d.RightToLeft='Yes'
$c=New-Object System.Windows.Forms.ComboBox
$c.SetBounds(12,15,496,35);$c.DropDownStyle='DropDownList';$c.DisplayMember='Display'
foreach($choice in $Choices){[void]$c.Items.Add($choice)};$c.SelectedIndex=0
$b=New-Object System.Windows.Forms.Button;$b.Text='تشغيل';$b.SetBounds(350,75,155,35);$b.DialogResult='OK'
$d.Controls.AddRange(@($c,$b));$d.AcceptButton=$b
try{if($d.ShowDialog() -eq 'OK'){return $c.SelectedItem}}finally{$d.Dispose()}
throw [System.OperationCanceledException]::new('إلغاء')
}
$mutex = New-Object System.Threading.Mutex($false, 'Local\MirsadUnifiedGuardian')
if (-not $mutex.WaitOne(0, $false)) {
if(-not [MirsadChromeWindow]::Reveal()){[System.Windows.Forms.MessageBox]::Show('المساعد يعمل بالفعل.','مرصاد') | Out-Null}
$mutex.Dispose()
exit 0
}
$tray = $null
$timer = $null
$form = $null
$hotkeys = $null
try {
$script:watched = [IntPtr]::Zero
$script:pending = $false
$script:deadline = [DateTime]::MinValue
$script:launch = $null
function Get-GuardianLaunch {
if ($script:launch) { return $script:launch }
$chrome = @(
(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
(Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
(Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
(Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
(Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $chrome) { throw 'لم أجد Google Chrome على هذا الجهاز.' }
$choices=@(Get-MirsadChoices -DataDir (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data') -Edition Auto -Profile $Profile)
$choice=Select-MirsadChoice -Choices $choices
[MirsadChromeWindow]::TitlePrefix=$choice.Prefix
[MirsadChromeTabs]::TitlePrefix=$choice.Prefix
$script:launch=@{Chrome=$chrome;Profile=$choice.Profile;Url=$choice.Url;Label=$choice.Label}
return $script:launch
}
function Set-GuardianRound($control, [int]$radius) {
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$d = $radius * 2; $w = $control.Width - 1; $h = $control.Height - 1
$path.AddArc(0,0,$d,$d,180,90); $path.AddArc(($w-$d),0,$d,$d,270,90)
$path.AddArc(($w-$d),($h-$d),$d,$d,0,90); $path.AddArc(0,($h-$d),$d,$d,90,90)
$path.CloseFigure(); $control.Region = New-Object System.Drawing.Region($path); $path.Dispose()
}
function New-GuardianLabel($parent,$value,$x,$y,$width,$height,$size,$color,$bold=$false) {
$label = New-Object System.Windows.Forms.Label
$label.Text = $value; $label.SetBounds($x,$y,$width,$height)
$style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
$label.Font = New-Object System.Drawing.Font('Segoe UI',$size,$style)
$label.ForeColor = [System.Drawing.ColorTranslator]::FromHtml($color)
$label.BackColor = [System.Drawing.Color]::Transparent; $label.TextAlign = 'MiddleRight'
$parent.Controls.Add($label); return $label
}
function New-GuardianButton($parent,$value,$x,$y,$width,$height,$background,$foreground) {
$button = New-Object System.Windows.Forms.Button
$button.Text = $value; $button.SetBounds($x,$y,$width,$height)
$button.FlatStyle = 'Flat'; $button.FlatAppearance.BorderSize = 0
$button.Font = New-Object System.Drawing.Font('Segoe UI',11,[System.Drawing.FontStyle]::Bold)
$button.BackColor = [System.Drawing.ColorTranslator]::FromHtml($background)
$button.ForeColor = [System.Drawing.ColorTranslator]::FromHtml($foreground)
$button.Cursor = [System.Windows.Forms.Cursors]::Hand
$button.UseVisualStyleBackColor = $false
$parent.Controls.Add($button); Set-GuardianRound $button 12
return $button
}
$form = New-Object System.Windows.Forms.Form
$form.Text = 'مرصاد | مساعد الرصد'
$form.ClientSize = New-Object System.Drawing.Size(210,210)
$form.StartPosition = 'Manual'; $form.FormBorderStyle = 'FixedSingle'; $form.MinimizeBox=$true
$form.MaximizeBox = $false; $form.TopMost = $false
$form.RightToLeft = 'Yes'; $form.RightToLeftLayout = $false
$form.AutoScaleMode = 'Dpi'; $form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96,96)
$form.Font = New-Object System.Drawing.Font('Segoe UI',11)
$form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#F2F6FA')
$bitmap = New-Object System.Drawing.Bitmap(64,64)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = 'AntiAlias'
$navyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#102A43'))
$tealBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#4DE0C1'))
$radarPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml('#4DE0C1'),3)
$graphics.FillEllipse($navyBrush,0,0,63,63)
$graphics.DrawArc($radarPen,10,10,44,44,180,270); $graphics.DrawArc($radarPen,20,20,24,24,180,270)
$graphics.DrawLine($radarPen,32,32,49,15); $graphics.FillEllipse($tealBrush,28,28,8,8)
$handle = $bitmap.GetHicon(); $sourceIcon = [System.Drawing.Icon]::FromHandle($handle)
$guardianIcon = $sourceIcon.Clone(); [MirsadChromeWindow]::DestroyIcon($handle) | Out-Null
$sourceIcon.Dispose(); $graphics.Dispose(); $bitmap.Dispose(); $navyBrush.Dispose(); $tealBrush.Dispose(); $radarPen.Dispose()
$form.Icon = $guardianIcon
$heading=New-GuardianLabel $form 'متابعة فتح مرصاد' 8 5 194 30 12 '#173B56' $true
$stateLabel=New-GuardianLabel $form 'جارٍ التشغيل' 8 36 194 48 9 '#173B56'
$startButton=New-GuardianButton $form 'تشغيل' 8 91 62 37 '#087F73' '#FFFFFF'
$pauseButton=New-GuardianButton $form 'إيقاف' 74 91 62 37 '#E2EAF1' '#23445D'
$exitButton=New-GuardianButton $form 'إغلاق' 140 91 62 37 '#A63838' '#FFFFFF'
$footer=New-GuardianLabel $form "Ctrl+Shift+Q إغلاق`nCtrl+Shift+P إيقاف`nCtrl+Shift+M تشغيل" 8 138 194 65 9 '#173B56'
$exitButton.add_Click({$form.Close()})
$pauseButton.add_Click({
$timer.Stop();[MirsadChromeTabs]::GuardHandle=0;if($script:watched){[MirsadChromeWindow]::Unpin($script:watched)}
[MirsadChromeWindow]::KeepAwake($false)|Out-Null
$startButton.Enabled=$true;$stateLabel.Text='الحماية متوقفة';$tray.Text='مرصاد: متوقف'
})
$tray = New-Object System.Windows.Forms.NotifyIcon
$tray.Icon = $guardianIcon
$tray.Text = 'مساعد مرصاد'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$show = $menu.Items.Add('فتح لوحة المساعد')
$show.add_Click({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })
$stop = $menu.Items.Add('إيقاف وإغلاق المساعد — إبقاء Chrome مفتوحًا')
$stop.add_Click({ $form.Close() })
$tray.ContextMenuStrip = $menu
$tray.add_DoubleClick({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })
$tray.Visible = $true
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.add_Tick({
try {
if (-not [MirsadChromeWindow]::KeepAwake($true)) { throw 'تعذر طلب منع السكون من ويندوز.' }
$windows = @([MirsadChromeWindow]::Windows())

[MirsadChromeTabs]::Request($windows)
$inventory = @([MirsadChromeTabs]::Snapshot() | Where-Object { $windows -contains [IntPtr]$_.Handle })
$fresh = ([DateTime]::UtcNow - [MirsadChromeTabs]::UpdatedUtc).TotalSeconds -lt 10
$existing = @($inventory | Where-Object { $_.Dashboard })
$target = $existing | Where-Object { [IntPtr]$_.Handle -eq $script:watched } | Select-Object -First 1
if (-not $target) { $target = $existing | Select-Object -First 1 }
if (-not $target) {
$visibleDashboard = $windows | Where-Object { [MirsadChromeWindow]::IsMirsad($_) } | Select-Object -First 1
if ($visibleDashboard) { $target = [PSCustomObject]@{Handle=$visibleDashboard.ToInt64()}; $fresh=$true }
}
if ($fresh -and $target) {
$handle = [IntPtr]$target.Handle
if ($script:watched -ne [IntPtr]::Zero -and $script:watched -ne $handle) { [MirsadChromeWindow]::Unpin($script:watched) }
$script:watched = $handle
[MirsadChromeTabs]::GuardHandle=0
$script:pending = $false
[MirsadChromeWindow]::Unpin($script:watched)
$stateLabel.Text = 'مرصاد مفتوح — لا يتم تغيير التركيز'
$tray.Text = 'مرصاد: متابعة فتح الصفحة'
return
}
if ($script:pending) {
if ([DateTime]::UtcNow -gt $script:deadline) { throw 'افتح مرصاد في Chrome ثم أعد تشغيل الحماية.' }
return
}
$unknown = @($inventory | Where-Object { -not $_.Reliable })
if ($windows.Count -gt 0 -and (-not $fresh -or $inventory.Count -ne $windows.Count -or $unknown.Count -gt 0)) {
$stateLabel.Text = 'جارٍ التحقق من تبويبات Chrome'
return
}
$launch = Get-GuardianLaunch
if ($windows -contains $script:watched) { [MirsadChromeWindow]::FocusForOpen($script:watched) }
elseif ($inventory.Count -gt 0) {
$source = $inventory | Where-Object { $_.Madrasati } | Select-Object -First 1
if (-not $source) { $source = $inventory[0] }
$script:watched = [IntPtr]$source.Handle
[MirsadChromeWindow]::FocusForOpen($script:watched)
}
$script:pending = $true
$script:deadline = [DateTime]::UtcNow.AddSeconds(45)
$stateLabel.Text = 'تبويب مرصاد غير موجود؛ جارٍ فتحه في نفس نافذة Chrome'
$tray.Text = 'مرصاد: يعيد فتح تبويب الرصد'
Start-Process -FilePath $launch.Chrome -ArgumentList @(('--profile-directory="' + $launch.Profile + '"'), '--new-tab', $launch.Url) | Out-Null
} catch {
$timer.Stop();[MirsadChromeTabs]::GuardHandle=0
if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
[MirsadChromeWindow]::KeepAwake($false) | Out-Null
$stateLabel.Text = 'توقفت الحماية — أعد المحاولة'
$stateLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#B45309')
$startButton.Enabled = $true
$tray.Text = 'مرصاد: المراقبة متوقفة'
[System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'توقف مساعد مرصاد', 'OK', 'Error') | Out-Null
}
})
$startButton.add_Click({
if ($timer.Enabled) { return }
$warning="يعيد المساعد فتح مرصاد إذا أغلقته فقط. يمكنك تصغير النوافذ وفتح أي برنامج. لا يغيّر تبويب تيمز ولا يثبّت كروم في المقدمة.`n`nCtrl + Shift + P : إيقاف`nCtrl + Shift + M : تشغيل`nCtrl + Shift + Q : إغلاق`n`nهل توافق على بدء الحماية؟"
$answer=[System.Windows.Forms.MessageBox]::Show($form,$warning,'قبل تشغيل الحماية',[System.Windows.Forms.MessageBoxButtons]::YesNo,[System.Windows.Forms.MessageBoxIcon]::Information,[System.Windows.Forms.MessageBoxDefaultButton]::Button2)
if($answer -ne [System.Windows.Forms.DialogResult]::Yes){$stateLabel.Text='لم تبدأ الحماية';return}
try{$null=Get-GuardianLaunch}catch{$stateLabel.Text=$_.Exception.Message;return}
$script:watched = [IntPtr]::Zero
$script:pending = $false
$script:autoHide = $false
$stateLabel.Text = 'جارٍ البحث عن نافذة مرصاد المفتوحة'
$stateLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#087F73')
$startButton.Enabled = $false
$tray.Text = 'مرصاد: مراقبة Chrome تعمل'
$timer.Start()
})
$form.add_Shown({
$area=[System.Windows.Forms.Screen]::FromControl($form).WorkingArea
$form.Location=New-Object System.Drawing.Point(($area.Right-$form.Width-8),($area.Bottom-$form.Height-8))
$startButton.PerformClick()
})
$form.add_FormClosing({ $timer.Stop();[MirsadChromeTabs]::GuardHandle=0; if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null })
$hotkeys = New-Object MirsadHotkeys
$hotkeys.add_StartRequested({ $startButton.PerformClick() })
$hotkeys.add_PauseRequested({$pauseButton.PerformClick()})
$hotkeys.add_ExitRequested({
$timer.Stop();[MirsadChromeTabs]::GuardHandle=0
if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
[MirsadChromeWindow]::KeepAwake($false) | Out-Null
$form.Close()
})
if(-not $hotkeys.Register()){$footer.Text='الاختصارات محجوزة؛ استخدم الأزرار'}
[System.Windows.Forms.Application]::Run($form)
} catch {
[System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'مساعد مرصاد', 'OK', 'Error') | Out-Null
exit 1
} finally {
if ($hotkeys) { $hotkeys.Dispose() }
if ($timer) { $timer.Stop();[MirsadChromeTabs]::GuardHandle=0; $timer.Dispose() }
if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
[MirsadChromeWindow]::KeepAwake($false) | Out-Null
if ($tray) { $tray.Visible = $false; $tray.Dispose() }
if ($form) { $form.Dispose() }
if ($guardianIcon) { $guardianIcon.Dispose() }
$mutex.ReleaseMutex()
$mutex.Dispose()
}
