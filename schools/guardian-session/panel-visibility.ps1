function Show-GuardianPanel {
if($script:exiting -or !$form -or $form.IsDisposed){return}
$form.ShowInTaskbar=$true
$form.WindowState='Normal'
if($script:panelLocation){$form.Location=$script:panelLocation}
$form.TopMost=$true
$form.Show()
[MirsadChromeWindow]::ShowWindowAsync($form.Handle,9)|Out-Null
$form.BringToFront()
$form.Activate()
}
