Guardian 3.4.4

Uses the 3.4.3 WinForms control/foreground behavior. The dashboard is checked before any restore attempt. If Chrome has no visible windows, launch its selected profile with --restore-last-session and no explicit URL. If a previously observed dashboard disappears while Chrome remains, focus a Chrome window and attempt Ctrl+Shift+T once after confirming it is foreground and the user has released modifier keys. Wait up to 15 seconds for the dashboard to reappear; only then allow the existing direct URL fallback. Stop and Close cancel further restoration attempts; a successful dashboard match resets the one-attempt state.

This relies on Chrome's most recent closed tab/window/session. It cannot select a historical window by URL, guarantee recovery if other tabs were closed more recently, restore incognito history, or renew expired Madrasati authentication. Multiple profiles must be tested carefully because the keyboard shortcut applies to the focused Chrome profile.

The executable uses the repository's standard-library Go launcher with the script embedded and extracted to a fresh temporary directory. The executable is Windows GUI subsystem; the PowerShell child uses HideWindow and CREATE_NO_WINDOW. The ZIP contains one EXE and readme, no .ps1 or visible console launcher. No persistent task/service/startup registration is added.

Build: run prepare.py; compile each /tmp/mirsad-guardian-session-build/{Shared,Schools} with Go 1.24 (GOOS=windows GOARCH=amd64 go build -buildvcs=false -trimpath -ldflags='-H windowsgui -s -w' -o MirsadChromeGuardian.exe .); run package.py.

Validation: PowerShell restore state tests, actual pause/closing handler tests, parsing both editions, native C# compile and x64 INPUT layout, Go embedded script/extraction/cleanup tests, PE GUI subsystem and hidden PowerShell launch flags. Live Windows/Chrome restoration and taskbar behavior are not exercised in this Linux environment; verify before customer distribution.
