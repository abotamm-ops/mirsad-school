# User-started Chrome guardian. No startup registration or Windows policy changes.
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
    public static bool IsMirsad(IntPtr hwnd) { var title = new StringBuilder(1024); GetWindowText(hwnd, title, title.Capacity); return title.ToString().Contains("مرصاد"); }
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hwnd, int mode);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
    public static void Pin(IntPtr hwnd) { if ((GetWindowLong(hwnd,-20) & 8)==0) SetWindowPos(hwnd,new IntPtr(-1),0,0,0,0,0x13); }
    public static void Unpin(IntPtr hwnd) { if (IsWindow(hwnd)) SetWindowPos(hwnd,new IntPtr(-2),0,0,0,0,0x13); }
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
$mutex = New-Object System.Threading.Mutex($false, 'Local\MirsadChromeGuardian')
if (-not $mutex.WaitOne(0, $false)) {
    [System.Windows.Forms.MessageBox]::Show('مساعد إبقاء مرصاد مفتوحًا يعمل بالفعل. تجده بجانب الساعة.', 'مرصاد') | Out-Null
    $mutex.Dispose()
    exit 0
}
$tray = $null
$timer = $null
$form = $null
try {
    $chrome = @(
        (Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
        (Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe' -ErrorAction SilentlyContinue).'(default)',
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
        (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    if (-not $chrome) { throw 'لم أجد Google Chrome على هذا الجهاز.' }
    $dataDir = Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data'
    $profiles = @()
    foreach ($folder in (Get-ChildItem -LiteralPath $dataDir -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -match '^Profile [0-9]+$' })) {
        foreach ($name in @('Preferences', 'Secure Preferences')) {
            $file = Join-Path $folder.FullName $name
            if (-not (Test-Path -LiteralPath $file)) { continue }
            try {
                $settings = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
                if ($settings.extensions.settings.PSObject.Properties.Name -contains 'mdkhgdcnfibnemhiklpejojajjajhcbg') { $profiles += $folder.Name; break }
            } catch {}
        }
    }
    $profiles = @($profiles | Sort-Object -Unique)
    if ($Profile -and $profiles -notcontains $Profile) { throw 'إضافة مرصاد غير موجودة في ملف Chrome المحدد.' }
    if (-not $Profile) {
        if ($profiles.Count -eq 0) { throw 'لم أجد إضافة مرصاد المدرسية. افتح Chrome بملف الإضافة ثم أعد المحاولة.' }
        if ($profiles.Count -eq 1) { $Profile = $profiles[0] }
        else {
            Add-Type -AssemblyName Microsoft.VisualBasic
            $answer = [Microsoft.VisualBasic.Interaction]::InputBox(('اكتب اسم ملف Chrome الذي تستخدمه للرصد من هذه القائمة: ' + ($profiles -join ' / ')), 'اختيار ملف مرصاد', $profiles[0])
            if ($profiles -notcontains $answer) { throw 'لم يُحدد ملف Chrome صحيح؛ لم يبدأ المساعد.' }
            $Profile = $answer
        }
    }
    $script:watched = [IntPtr]::Zero
    $script:before = @()
    $script:pending = $false
    $script:deadline = [DateTime]::MinValue
    $script:failed = $false
    $script:guardianChrome = $chrome
    $script:guardianProfile = $Profile
    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'مساعد مرصاد'
    $form.Size = New-Object System.Drawing.Size(500,260)
    $form.StartPosition = 'CenterScreen'
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false
    $form.TopMost = $true
    $form.RightToLeft = 'Yes'
    $form.RightToLeftLayout = $true
    $form.Font = New-Object System.Drawing.Font('Segoe UI',11)
    $form.Icon = [System.Drawing.SystemIcons]::Shield
    $description = New-Object System.Windows.Forms.Label
    $description.Text = 'يبقي نافذة مرصاد مفتوحة ومكبّرة وفوق النوافذ الأخرى، ويمنع السكون أثناء عمل المساعد.'
    $description.SetBounds(20,15,445,60)
    $description.TextAlign = 'MiddleRight'
    $form.Controls.Add($description)
    $stateLabel = New-Object System.Windows.Forms.Label
    $stateLabel.SetBounds(20,80,445,40)
    $stateLabel.TextAlign = 'MiddleRight'
    $stateLabel.Text = 'جارٍ تجهيز المراقبة...'
    $form.Controls.Add($stateLabel)
    $startButton = New-Object System.Windows.Forms.Button
    $startButton.Text = 'تشغيل'
    $startButton.SetBounds(260,140,200,45)
    $form.Controls.Add($startButton)
    $exitButton = New-Object System.Windows.Forms.Button
    $exitButton.Text = 'إيقاف وإغلاق'
    $exitButton.SetBounds(30,140,200,45)
    $exitButton.add_Click({ $form.Close() })
    $form.Controls.Add($exitButton)
    $tray = New-Object System.Windows.Forms.NotifyIcon
    $tray.Icon = [System.Drawing.SystemIcons]::Shield
    $tray.Text = 'مساعد مرصاد'
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $show = $menu.Items.Add('فتح لوحة المساعد')
    $show.add_Click({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })
    $stop = $menu.Items.Add('إيقاف وإغلاق المساعد — إبقاء Chrome مفتوحًا')
    $stop.add_Click({ $form.Close() })
    $tray.ContextMenuStrip = $menu
    $tray.add_DoubleClick({ $form.Show(); $form.WindowState = 'Normal'; $form.Activate() })
    $tray.Visible = $true
    $form.add_Resize({ if ($form.WindowState -eq 'Minimized') { $form.Hide() } })
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 2000
    $timer.add_Tick({
        try {
            if (-not [MirsadChromeWindow]::KeepAwake($true)) { throw 'تعذر طلب منع السكون من ويندوز.' }
            $windows = @([MirsadChromeWindow]::Windows())
            if ($script:watched -ne [IntPtr]::Zero -and $windows -contains $script:watched) {
                [MirsadChromeWindow]::Pin($script:watched)
                if ([MirsadChromeWindow]::IsIconic($script:watched) -or -not [MirsadChromeWindow]::IsZoomed($script:watched)) {
                    [MirsadChromeWindow]::ShowWindowAsync($script:watched, 3) | Out-Null
                }
                return
            }
            $script:watched = [IntPtr]::Zero
            if ($script:pending) {
                $newWindows = @($windows | Where-Object { $script:before -notcontains $_ -and [MirsadChromeWindow]::IsMirsad($_) })
                if ($newWindows.Count -eq 1) { $script:watched = $newWindows[0]; [MirsadChromeWindow]::Pin($script:watched); $script:pending = $false; if ($script:autoHide) { $form.Hide(); $script:autoHide = $false }; return }
                if ($newWindows.Count -gt 1) { throw 'ظهرت عدة نوافذ جديدة معًا. أعد تشغيل المساعد دون فتح نوافذ أخرى أثناء البدء.' }
                if ([DateTime]::UtcNow -gt $script:deadline) { throw 'لم تظهر نافذة Chrome خلال 45 ثانية. تحقق من شاشة اختيار الملف أو استعادة المتصفح، ثم أعد تشغيل المساعد.' }
                return
            }
            $script:before = $windows
            $script:pending = $true
            $script:deadline = [DateTime]::UtcNow.AddSeconds(45)
            Start-Process -FilePath $script:guardianChrome -ArgumentList @(('--profile-directory="' + $script:guardianProfile + '"'), '--new-window', '--start-maximized', 'https://mirsad-school.onrender.com/automatic-monitoring.html?guardian=1') | Out-Null
        } catch {
            $script:failed = $true
            $timer.Stop()
            if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
            [MirsadChromeWindow]::KeepAwake($false) | Out-Null
            $stateLabel.Text = 'توقفت المراقبة؛ يمكنك إعادة التشغيل.'
            $startButton.Enabled = $true
            $tray.Text = 'مرصاد: المراقبة متوقفة'
            [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'توقف مساعد مرصاد', 'OK', 'Error') | Out-Null
        }
    })
    $startButton.add_Click({
        if ($timer.Enabled) { return }
        $script:watched = [IntPtr]::Zero
        $script:before = @()
        $script:pending = $false
        $script:failed = $false
        $script:autoHide = $true
        $stateLabel.Text = 'المراقبة تعمل — ملف Chrome: ' + $script:guardianProfile
        $startButton.Enabled = $false
        $tray.Text = 'مرصاد: مراقبة Chrome تعمل'
        $timer.Start()
    })
    $form.add_Shown({ $startButton.PerformClick() })
    $form.add_FormClosing({ $timer.Stop(); if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }; [MirsadChromeWindow]::KeepAwake($false) | Out-Null })
    [System.Windows.Forms.Application]::Run($form)

} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'مساعد مرصاد', 'OK', 'Error') | Out-Null
    exit 1
} finally {
    if ($timer) { $timer.Stop(); $timer.Dispose() }
    if ($script:watched) { [MirsadChromeWindow]::Unpin($script:watched) }
    [MirsadChromeWindow]::KeepAwake($false) | Out-Null
    if ($tray) { $tray.Visible = $false; $tray.Dispose() }
    if ($form) { $form.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
