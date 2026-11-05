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
    $form.ClientSize = New-Object System.Drawing.Size(560,602)
    $form.StartPosition = 'CenterScreen'; $form.FormBorderStyle = 'None'
    $form.MaximizeBox = $false; $form.TopMost = $true
    $form.RightToLeft = 'Yes'; $form.RightToLeftLayout = $false
    $form.AutoScaleMode = 'Dpi'; $form.AutoScaleDimensions = New-Object System.Drawing.SizeF(96,96)
    $form.Font = New-Object System.Drawing.Font('Segoe UI',11)
    $form.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#F2F6FA')
    Set-GuardianRound $form 22
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
    $header = New-Object System.Windows.Forms.Panel
    $header.SetBounds(0,0,560,164); $header.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#102A43')
    $form.Controls.Add($header)
    $header.add_MouseDown({ param($sender,$eventArgs) if ($eventArgs.Button -eq 'Left') { [MirsadChromeWindow]::Drag($form.Handle) } })
    $brand = New-GuardianLabel $header 'مرصاد' 190 40 330 58 27 '#FFFFFF' $true
    $brand.add_MouseDown({ param($sender,$eventArgs) if ($eventArgs.Button -eq 'Left') { [MirsadChromeWindow]::Drag($form.Handle) } })
    $subtitle = New-GuardianLabel $header 'مساعد استمرارية الرصد' 160 98 360 32 12 '#9DB6C9'
    $version = New-GuardianLabel $header 'DESKTOP  /  1.2.1' 26 110 170 28 9 '#65DCC5'
    $version.TextAlign = 'MiddleLeft'; $version.RightToLeft = 'No'
    $closeButton = New-GuardianButton $header '×' 18 14 38 30 '#203E55' '#FFFFFF'
    $closeButton.AccessibleName = 'إيقاف المساعد وإغلاقه'; $closeButton.add_Click({ $form.Close() })
    $hideButton = New-GuardianButton $header '−' 64 14 38 30 '#203E55' '#FFFFFF'
    $hideButton.AccessibleName = 'إخفاء المساعد بجانب الساعة'; $hideButton.add_Click({ $form.Hide() })
    $statusCard = New-Object System.Windows.Forms.Panel
    $statusCard.SetBounds(24,186,512,108); $statusCard.BackColor = [System.Drawing.Color]::White
    $form.Controls.Add($statusCard); Set-GuardianRound $statusCard 16
    $statusHeading = New-GuardianLabel $statusCard 'حالة المساعد' 20 10 470 28 10 '#668096'
    $stateLabel = New-GuardianLabel $statusCard 'جارٍ تجهيز المراقبة...' 20 40 470 47 13 '#173B56' $true
    $sectionHeading = New-GuardianLabel $form 'حماية نافذة الرصد' 24 312 512 30 12 '#173B56' $true
    $featureCard = New-Object System.Windows.Forms.Panel
    $featureCard.SetBounds(24,352,512,106); $featureCard.BackColor = [System.Drawing.Color]::White
    $form.Controls.Add($featureCard); Set-GuardianRound $featureCard 16
    $featureTitles = @('في المقدمة','إعادة الفتح','منع السكون')
    $featureHints = @('فوق النوافذ العادية','عند إغلاق النافذة','أثناء تشغيل المساعد')
    for ($i=0; $i -lt 3; $i++) {
        $x = 352 - $i * 168
        $title = New-GuardianLabel $featureCard $featureTitles[$i] $x 16 144 32 11 '#117D70' $true
        $hint = New-GuardianLabel $featureCard $featureHints[$i] $x 50 144 30 9 '#668096'
        $title.TextAlign = 'MiddleCenter'; $hint.TextAlign = 'MiddleCenter'
    }
    $startButton = New-GuardianButton $form 'تشغيل الحماية' 292 482 244 50 '#087F73' '#FFFFFF'
    $exitButton = New-GuardianButton $form 'إيقاف وإغلاق' 24 482 244 50 '#E2EAF1' '#23445D'
    $startButton.AccessibleName = 'تشغيل حماية نافذة مرصاد'; $exitButton.add_Click({ $form.Close() })
    $footer = New-GuardianLabel $form 'إيقاف المساعد يترك Chrome مفتوحًا' 24 546 512 30 9 '#668096'
    $footer.TextAlign = 'MiddleCenter'
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
            $stateLabel.Text = 'توقفت الحماية — أعد المحاولة'
            $stateLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#B45309')
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
        $stateLabel.Text = 'الحماية تعمل  •  ' + $script:guardianProfile
        $stateLabel.ForeColor = [System.Drawing.ColorTranslator]::FromHtml('#087F73')
        $startButton.Enabled = $false
        $tray.Text = 'مرصاد: مراقبة Chrome تعمل'
        $timer.Start()
    })
    $form.add_Shown({ Set-GuardianRound $form 22; Set-GuardianRound $statusCard 16; Set-GuardianRound $featureCard 16; foreach ($button in @($startButton,$exitButton,$hideButton,$closeButton)) { Set-GuardianRound $button 12 }; $startButton.PerformClick() })
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
    if ($guardianIcon) { $guardianIcon.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
