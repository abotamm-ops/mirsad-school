# User-started Chrome guardian. No startup registration or Windows policy changes.
param([ValidatePattern('^(Default|Profile [0-9]+)$')][string]$Profile = '', [ValidateSet('Auto','Private','Schools')][string]$Edition = 'Auto')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Guardian-Selection.ps1')
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
    public static string TitlePrefix = "";
    public static bool IsMirsad(IntPtr hwnd) { var title = new StringBuilder(1024); GetWindowText(hwnd, title, title.Capacity); return TitlePrefix.Length>0 && title.ToString().Trim().StartsWith(TitlePrefix,StringComparison.Ordinal); }
    public static bool IsTeams(IntPtr hwnd) { var title=new StringBuilder(1024); GetWindowText(hwnd,title,title.Capacity); return title.ToString().IndexOf("Teams",StringComparison.OrdinalIgnoreCase)>=0 || title.ToString().Contains("تيمز"); }
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd, int mode);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll", EntryPoint="SetWindowLongW")] static extern int SetWindowLong(IntPtr hwnd,int index,int value);
    [DllImport("user32.dll")] static extern IntPtr GetSystemMenu(IntPtr hwnd,bool revert);
    [DllImport("user32.dll")] static extern bool EnableMenuItem(IntPtr menu,uint item,uint flags);
    [DllImport("user32.dll")] static extern bool DrawMenuBar(IntPtr hwnd);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
    struct Saved { public int Style; public bool Topmost; }
    static readonly Dictionary<IntPtr,Saved> saved=new Dictionary<IntPtr,Saved>();
    delegate IntPtr KeyboardProc(int code,IntPtr wparam,IntPtr lparam);
    static readonly KeyboardProc keyboardProc=Keyboard;
    static IntPtr keyboardHook=IntPtr.Zero,protectedWindow=IntPtr.Zero;
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int type,KeyboardProc callback,IntPtr module,uint thread);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook,int code,IntPtr wp,IntPtr lp);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    static IntPtr Keyboard(int code,IntPtr wp,IntPtr lp) {
        if(code>=0 && protectedWindow!=IntPtr.Zero && GetForegroundWindow()==protectedWindow && (wp.ToInt32()==0x100||wp.ToInt32()==0x104)) {
            int key=Marshal.ReadInt32(lp),flags=Marshal.ReadInt32(lp,8);
            bool control=(GetAsyncKeyState(0x11)&0x8000)!=0;
            // Limit interception to the guarded Chrome window. Ctrl+Shift+Q always remains available.
            if((key==0x73&&(flags&0x20)!=0)||(key==0x57&&control))return new IntPtr(1);
        }
        return CallNextHookEx(keyboardHook,code,wp,lp);
    }
    public static void Pin(IntPtr hwnd) {
        if(!IsWindow(hwnd))return;
        if(keyboardHook==IntPtr.Zero) {
            keyboardHook=SetWindowsHookEx(13,keyboardProc,GetModuleHandle(null),0);
            if(keyboardHook==IntPtr.Zero)throw new InvalidOperationException("تعذر تفعيل حماية اختصارات نافذة الرصد");
        }
        protectedWindow=hwnd;
        if(!saved.ContainsKey(hwnd)) {
            var state=new Saved { Style=GetWindowLong(hwnd,-16),Topmost=(GetWindowLong(hwnd,-20)&8)!=0 };
            saved[hwnd]=state;
            SetWindowLong(hwnd,-16,state.Style & ~0x30000); // restore on Stop/Exit
            EnableMenuItem(GetSystemMenu(hwnd,false),0xF060,1); DrawMenuBar(hwnd);
        }
        if(IsIconic(hwnd)||!IsZoomed(hwnd))ShowWindowAsync(hwnd,3);
        SetWindowPos(hwnd,new IntPtr(-1),0,0,0,0,0x33);
    }
    public static void Unpin(IntPtr hwnd) {
        if(protectedWindow==hwnd) { protectedWindow=IntPtr.Zero;if(keyboardHook!=IntPtr.Zero){UnhookWindowsHookEx(keyboardHook);keyboardHook=IntPtr.Zero;} }
        Saved state;if(!saved.TryGetValue(hwnd,out state))return;
        saved.Remove(hwnd);if(!IsWindow(hwnd))return;
        SetWindowLong(hwnd,-16,state.Style);
        GetSystemMenu(hwnd,true);DrawMenuBar(hwnd);
        SetWindowPos(hwnd,new IntPtr(state.Topmost?-1:-2),0,0,0,0,0x33);
    }
    public static void GuardForeground(IntPtr hwnd,IntPtr panel) {
        var active=GetForegroundWindow();
        // Never change Chrome's selected tab: Teams must retain control while scanning/capturing.
        if(active!=hwnd && active!=panel)SetForegroundWindow(hwnd);
        if(!IsIconic(panel))SetWindowPos(panel,new IntPtr(-1),0,0,0,0,0x13);
    }
    public static void FocusForOpen(IntPtr hwnd) { if(!IsWindow(hwnd))return; if(IsIconic(hwnd))ShowWindowAsync(hwnd,3);SetForegroundWindow(hwnd); }
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
# Inspect tab-strip titles off the UI thread; the active page may be Madrasati, Teams or YouTube.
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
    static readonly object gate=new object();
    static MirsadWindowTabs[] snapshot=new MirsadWindowTabs[0];
    static bool busy;
    static DateTime updated=DateTime.MinValue;
    public static DateTime UpdatedUtc { get { lock(gate) return updated; } }
    public static MirsadWindowTabs[] Snapshot() { lock(gate) return (MirsadWindowTabs[])snapshot.Clone(); }
    public static string TitlePrefix = "";
    public static bool DashboardTitle(string name) { return TitlePrefix.Length>0 && name!=null && name.Trim().StartsWith(TitlePrefix,StringComparison.Ordinal); }
    public static MirsadWindowTabs Inspect(IntPtr handle) {
        var result=new MirsadWindowTabs { Handle=handle.ToInt64() };
        try {
            var root=AutomationElement.FromHandle(handle);
            if(root==null)return result;
            var queue=new Queue<Tuple<AutomationElement,int>>();
            queue.Enqueue(Tuple.Create(root,0));
            int visited=0; bool sawTabs=false, truncated=false;
            while(queue.Count>0 && visited<1800) {
                var entry=queue.Dequeue(); visited++;
                var current=entry.Item1.Current;
                if(current.ControlType==ControlType.TabItem) {
                    sawTabs=true;
                    if(DashboardTitle(current.Name)) result.Dashboard=true;
                    if((current.Name??"").Contains("مدرستي")) result.Madrasati=true;
                    continue;
                }
                // Tab-strip inventory only: never traverse meeting/document contents.
                if(current.ControlType==ControlType.Document)continue;
                if(entry.Item2>=16) { truncated=true; continue; }
                var children=entry.Item1.FindAll(TreeScope.Children,Condition.TrueCondition);
                foreach(AutomationElement child in children) queue.Enqueue(Tuple.Create(child,entry.Item2+1));
            }
            result.Reliable=result.Dashboard || (sawTabs && !truncated && queue.Count==0);
        } catch { result.Reliable=false; }
        return result;
    }
    public static void Request(IntPtr[] handles) {
        lock(gate) { if(busy || DateTime.UtcNow-updated<TimeSpan.FromSeconds(2)) return; busy=true; }
        var copy=(IntPtr[])handles.Clone();
        // A blocked Chrome accessibility provider cannot freeze the exit shortcut or spawn unbounded workers.
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
# Thread-global shortcuts remain available while the form is hidden or another app has focus.
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public sealed class MirsadHotkeys : IMessageFilter, IDisposable {
    [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
    [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window,int id);
    public event EventHandler StartRequested;
    public event EventHandler ExitRequested;
    bool registered;
    public bool Register() {
        if (!RegisterHotKey(IntPtr.Zero,902,0x4006,0x51)) return false;
        if (!RegisterHotKey(IntPtr.Zero,901,0x4006,0x4D)) { UnregisterHotKey(IntPtr.Zero,902); return false; }
        registered=true; Application.AddMessageFilter(this); return true;
    }
    public bool PreFilterMessage(ref Message message) {
        if(message.Msg!=0x0312) return false;
        if(message.WParam.ToInt32()==902) { if(ExitRequested!=null) ExitRequested(this,EventArgs.Empty); return true; }
        if(message.WParam.ToInt32()==901) { if(StartRequested!=null) StartRequested(this,EventArgs.Empty); return true; }
        return false;
    }
    public void Dispose() { if(!registered)return; registered=false; UnregisterHotKey(IntPtr.Zero,901); UnregisterHotKey(IntPtr.Zero,902); Application.RemoveMessageFilter(this); }
}
'@
$mutex = New-Object System.Threading.Mutex($false, 'Local\MirsadUnifiedGuardian')
if (-not $mutex.WaitOne(0, $false)) {
    [System.Windows.Forms.MessageBox]::Show('مساعد إبقاء مرصاد مفتوحًا يعمل بالفعل. تجده بجانب الساعة.', 'مرصاد') | Out-Null
    $mutex.Dispose()
    exit 0
}
# Refuse to compete with an older helper; never kill it or change Chrome.
foreach ($legacyName in @('Local\MirsadChromeGuardian','Local\MirsadSchoolsGuardian')) {
    $legacy=New-Object System.Threading.Mutex($false,$legacyName)
    $owned=$false
    try {
        try { $owned=$legacy.WaitOne(0,$false) } catch [System.Threading.AbandonedMutexException] { $owned=$true }
        if (-not $owned) {
            [System.Windows.Forms.MessageBox]::Show('أغلق مساعد مرصاد القديم من أيقونته بجانب الساعة، ثم افتح المساعد المشترك. لا تحتاج إغلاق Chrome أو حذف الإضافة.','مساعد مرصاد') | Out-Null
            $mutex.ReleaseMutex(); $mutex.Dispose(); exit 0
        }
    } finally { if ($owned) { $legacy.ReleaseMutex() }; $legacy.Dispose() }
}
$tray = $null
$timer = $null
$form = $null
$hotkeys = $null
try {
    $script:watched = [IntPtr]::Zero
    $script:scanWindow = [IntPtr]::Zero
    $script:failed = $false
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
        $dataDir = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
        $choices = @(Get-MirsadChoices -DataDir $dataDir -Edition $Edition -Profile $Profile)
        $choice = Select-MirsadChoice -Choices $choices
        [MirsadChromeWindow]::TitlePrefix=$choice.Prefix
        [MirsadChromeTabs]::TitlePrefix=$choice.Prefix
        $script:launch = @{Chrome=$chrome; Profile=$choice.Profile; Url=$choice.Url; Edition=$choice.Edition; Label=$choice.Label}
        return $script:launch
    }
    $selectedLaunch=Get-GuardianLaunch
    # Stable shortcut points to the EXE, never to the temporary extracted PowerShell script.
    if($env:MIRSAD_GUARDIAN_LAUNCHER -and (Test-Path -LiteralPath $env:MIRSAD_GUARDIAN_LAUNCHER)) {
        try {
            $shell=New-Object -ComObject WScript.Shell
            $shortcut=$shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'مرصاد - مساعد الرصد.lnk'))
            $shortcut.TargetPath=$env:MIRSAD_GUARDIAN_LAUNCHER
            $shortcut.WorkingDirectory=Split-Path -Parent $env:MIRSAD_GUARDIAN_LAUNCHER
            $shortcut.IconLocation=$env:MIRSAD_GUARDIAN_LAUNCHER+',0'
            $shortcut.Description='مساعد مرصاد المشترك — تشغيل / إيقاف / إغلاق'
            $shortcut.Save()
        } catch {} # A restricted Start menu must not prevent recording.
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
    $form.Text = 'مرصاد | مساعد الرصد 3.2.0'
    # Approximately 50 mm overall at 96 logical DPI; ordinary taskbar/minimize/close controls.
    $form.Size = New-Object System.Drawing.Size(189,189)
    $form.StartPosition = 'Manual'; $form.FormBorderStyle = 'FixedSingle'
    $form.MaximizeBox = $false; $form.MinimizeBox = $true; $form.TopMost = $true
    $form.ShowInTaskbar = $true; $form.RightToLeft = 'Yes'
    $form.AutoScaleMode = 'Dpi'; $form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96,96)
    $form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#102A43')
    # A small radar mark, drawn locally; no external images or network calls.
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
    $stateLabel = New-GuardianLabel $form 'مرصاد — متوقف' 6 2 160 24 9 '#FFFFFF' $true
    $stateLabel.TextAlign = 'MiddleCenter'
    $startButton = New-GuardianButton $form 'تشغيل' 9 30 155 32 '#087F73' '#FFFFFF'
    $pauseButton = New-GuardianButton $form 'إيقاف' 9 69 155 32 '#D9A441' '#102A43'
    $exitButton = New-GuardianButton $form 'إغلاق' 9 108 155 32 '#953D47' '#FFFFFF'
    foreach($button in @($startButton,$pauseButton,$exitButton)) { $button.Font = New-Object System.Drawing.Font('Segoe UI',9,[System.Drawing.FontStyle]::Bold) }
    $startButton.AccessibleName = 'تشغيل تثبيت نافذة مرصاد'
    $pauseButton.AccessibleName = 'إيقاف التثبيت مع بقاء التطبيق'
    $exitButton.AccessibleName = 'إيقاف وإغلاق المساعد بالكامل'
    $tip=New-Object System.Windows.Forms.ToolTip
    $tip.SetToolTip($stateLabel,($selectedLaunch.Label+' — 3.2.0'))
    $tip.SetToolTip($pauseButton,'يفك تثبيت نافذة Chrome فقط؛ لا يوقف الرصد في الإضافة')
    function Set-GuardianCorner {
        $area=[System.Windows.Forms.Screen]::FromControl($form).WorkingArea
        $form.Location=New-Object System.Drawing.Point(($area.Right-$form.Width),($area.Bottom-$form.Height))
    }
    $tray = New-Object System.Windows.Forms.NotifyIcon
    $tray.Icon=$guardianIcon; $tray.Text='مساعد مرصاد'; $tray.Visible=$true
    $menu=New-Object System.Windows.Forms.ContextMenuStrip
    $resume=$menu.Items.Add('تشغيل');$resume.add_Click({$startButton.PerformClick()})
    $pause=$menu.Items.Add('إيقاف');$pause.add_Click({$pauseButton.PerformClick()})
    $exit=$menu.Items.Add('إغلاق');$exit.add_Click({$form.Close()})
    $tray.ContextMenuStrip=$menu
    $tray.add_DoubleClick({$form.Show();Set-GuardianCorner})
    $exitButton.add_Click({$form.Close()})
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 350
    $timer.add_Tick({
        try {
            if (-not [MirsadChromeWindow]::KeepAwake($true)) { throw 'تعذر طلب منع السكون من ويندوز.' }
            $windows = @([MirsadChromeWindow]::Windows())
            [MirsadChromeTabs]::Request($windows)
            $inventory = @([MirsadChromeTabs]::Snapshot() | Where-Object { $windows -contains [IntPtr]$_.Handle })
            $fresh = ([DateTime]::UtcNow - [MirsadChromeTabs]::UpdatedUtc).TotalSeconds -lt 10
            # Presence is checked across the whole tab strip, never from the active page's window title.
            $existing = @($inventory | Where-Object { $_.Dashboard })
            $target = $existing | Where-Object { [IntPtr]$_.Handle -eq $script:watched } | Select-Object -First 1
            if (-not $target -and $existing.Count -gt 1) { throw 'وجدت أكثر من نافذة للنسخة المحددة؛ أبقِ لوحة الرصد المطلوبة في نافذة واحدة ثم أعد المحاولة.' }
            if (-not $target) { $target = $existing | Select-Object -First 1 }
            if (-not $target) {
                $visibleDashboard = $windows | Where-Object { [MirsadChromeWindow]::IsMirsad($_) } | Select-Object -First 1
                if ($visibleDashboard) { $target = [PSCustomObject]@{Handle=$visibleDashboard.ToInt64()}; $fresh=$true }
            }
            if ($fresh -and $target) {
                $handle = [IntPtr]$target.Handle
                if ($script:watched -ne [IntPtr]::Zero -and $script:watched -ne $handle) { [MirsadChromeWindow]::Unpin($script:watched) }
                $script:watched = $handle
                $script:pending = $false
                [MirsadChromeWindow]::Pin($script:watched)
                $stateLabel.Text = 'مرصاد — يعمل'
                $tray.Text = $script:launch.Label+': الحماية تعمل'
                [MirsadChromeWindow]::GuardForeground($script:watched,$form.Handle)
                return
            }
            if ($script:pending) {
                if ([DateTime]::UtcNow -gt $script:deadline) { throw 'لم يتأكد وجود تبويب مرصاد بعد الفتح؛ افتح تبويبه في Chrome ثم أعد تشغيل الحماية.' }
                return
            }
            # If Chrome cannot expose its tab strip, never interpret uncertainty as absence and create duplicates.
            $unknown = @($inventory | Where-Object { -not $_.Reliable })
            if ($windows.Count -gt 0 -and (-not $fresh -or $inventory.Count -ne $windows.Count -or $unknown.Count -gt 0)) {
                $stateLabel.Text = 'فحص التبويبات…'
                return
            }
            $launch = Get-GuardianLaunch
            if ($windows -contains $script:watched) { [MirsadChromeWindow]::FocusForOpen($script:watched) }
            $script:pending = $true
            $script:deadline = [DateTime]::UtcNow.AddSeconds(45)
            $stateLabel.Text = 'إعادة فتح مرصاد…'
            $tray.Text = 'مرصاد: يعيد فتح تبويب الرصد'
            Start-Process -FilePath $launch.Chrome -ArgumentList @(('--profile-directory="' + $launch.Profile + '"'), '--new-tab', $launch.Url) | Out-Null

        } catch {
            $script:failed = $true
            $timer.Stop()
            if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
            if ($script:scanWindow -ne [IntPtr]::Zero) { [MirsadChromeWindow]::Unpin($script:scanWindow) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null
            $stateLabel.Text = 'مرصاد — متوقف'
            $stateLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#B45309')
            $startButton.Enabled = $true
            $tray.Text = 'مرصاد: المراقبة متوقفة'
            [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'توقف مساعد مرصاد', 'OK', 'Error') | Out-Null
        }
    })
    $startButton.add_Click({
        if ($timer.Enabled) { return }
        $script:watched = [IntPtr]::Zero
        $script:pending = $false
        $script:failed = $false
        $stateLabel.Text = 'جارٍ التشغيل…'
        $stateLabel.ForeColor = [System.Drawing.Color]::White
        $startButton.Enabled = $false
        $tray.Text = 'مرصاد: مراقبة Chrome تعمل'
        $timer.Start()
    })
    $pauseButton.add_Click({
        $timer.Stop()
        if($script:watched -ne [IntPtr]::Zero){[MirsadChromeWindow]::Unpin($script:watched)}
        $script:watched=[IntPtr]::Zero; $script:pending=$false
        [MirsadChromeWindow]::KeepAwake($false) | Out-Null
        $startButton.Enabled=$true; $stateLabel.Text='مرصاد — متوقف'
        $stateLabel.ForeColor=[System.Drawing.Color]::White; $tray.Text='مرصاد: التثبيت متوقف'
    })
    $form.add_Shown({Set-GuardianCorner;$startButton.PerformClick()})
    $form.add_FormClosing({ $timer.Stop(); if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }; if ($script:scanWindow -ne [IntPtr]::Zero) { [MirsadChromeWindow]::Unpin($script:scanWindow) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null })
    $hotkeys = New-Object MirsadHotkeys
    $hotkeys.add_StartRequested({ $startButton.PerformClick() })
    $hotkeys.add_ExitRequested({
        $timer.Stop()
        if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
        if ($script:scanWindow -ne [IntPtr]::Zero) { [MirsadChromeWindow]::Unpin($script:scanWindow) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null
        $form.Close()
    })
    if (-not $hotkeys.Register()) { throw 'تعذر تسجيل اختصار الخروج لأنها مستخدمة في برنامج آخر. لم تبدأ الحماية؛ أغلق البرنامج الآخر وأعد المحاولة.' }
    [System.Windows.Forms.Application]::Run($form)

} catch {
    if ($_.Exception -is [System.OperationCanceledException]) { exit 0 }
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'مساعد مرصاد', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($hotkeys) { $hotkeys.Dispose() }
    if ($timer) { $timer.Stop(); $timer.Dispose() }
    if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
    if ($script:scanWindow -ne [IntPtr]::Zero) { [MirsadChromeWindow]::Unpin($script:scanWindow) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null
    if ($tray) { $tray.Visible = $false; $tray.Dispose() }
    if ($tip) { $tip.Dispose() }
    if ($form) { $form.Dispose() }
    if ($guardianIcon) { $guardianIcon.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
