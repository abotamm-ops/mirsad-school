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

function Select-MirsadChoice {
    param([object[]]$Choices)
    if ($Choices.Count -eq 0) { throw 'لم أجد إضافة مرصاد مفعّلة في Chrome. فعّل إضافة الخاص أو المدارس ثم أعد تشغيل المساعد.' }
    if ($Choices.Count -eq 1) { return $Choices[0] }
    $dialog=New-Object System.Windows.Forms.Form
    $dialog.TopMost=$true; $dialog.Text='أي مرصاد تريد تشغيل مساعده؟'; $dialog.StartPosition='CenterScreen'; $dialog.ClientSize=New-Object System.Drawing.Size(550,200)
    $dialog.RightToLeft='Yes'; $dialog.FormBorderStyle='FixedDialog'; $dialog.MaximizeBox=$false; $dialog.MinimizeBox=$false
    $dialog.Font=New-Object System.Drawing.Font('Segoe UI',11)
    $label=New-Object System.Windows.Forms.Label; $label.Text='اختر النسخة وحساب Chrome. لا يغيّر المساعد بيانات الإضافتين.'; $label.SetBounds(20,20,510,45)
    $list=New-Object System.Windows.Forms.ComboBox; $list.DropDownStyle='DropDownList'; $list.SetBounds(20,70,510,35); $list.DisplayMember='Display'
    foreach ($choice in $Choices) { [void]$list.Items.Add($choice) }; $list.SelectedIndex=0
    $ok=New-Object System.Windows.Forms.Button; $ok.Text='تشغيل النسخة المحددة'; $ok.SetBounds(290,130,240,40); $ok.DialogResult='OK'
    $cancel=New-Object System.Windows.Forms.Button; $cancel.Text='إلغاء'; $cancel.SetBounds(20,130,140,40); $cancel.DialogResult='Cancel'
    $dialog.Controls.AddRange(@($label,$list,$ok,$cancel)); $dialog.AcceptButton=$ok; $dialog.CancelButton=$cancel
    try { if ($dialog.ShowDialog() -eq 'OK') { return $list.SelectedItem } } finally { $dialog.Dispose() }
    throw [System.OperationCanceledException]::new('أُلغي اختيار النسخة')
}
