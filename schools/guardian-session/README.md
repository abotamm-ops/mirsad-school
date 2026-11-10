Guardian 3.4.5

Uses the 3.4.3 WinForms control/foreground behavior. The dashboard is checked before any restore attempt. If Chrome has no visible windows, launch its selected profile with --restore-last-session and no explicit URL. If a previously observed dashboard disappears while Chrome remains, focus a Chrome window and attempt Ctrl+Shift+T once after confirming it is foreground and the user has released modifier keys. Wait up to 15 seconds for the dashboard to reappear; only then allow the existing direct URL fallback. Stop and Close cancel further restoration attempts; a successful dashboard match resets the one-attempt state.

This relies on Chrome's most recent closed tab/window/session. It cannot select a historical window by URL, guarantee recovery if other tabs were closed more recently, restore incognito history, or renew expired Madrasati authentication. Multiple profiles must be tested carefully because the keyboard shortcut applies to the focused Chrome profile.

The executable uses the repository's standard-library Go launcher with the script embedded and extracted to a fresh temporary directory. The executable is Windows GUI subsystem; the PowerShell child uses HideWindow and CREATE_NO_WINDOW. The ZIP contains one EXE and readme, no .ps1 or visible console launcher. No persistent task/service/startup registration is added.

Build: run prepare.py; compile each /tmp/mirsad-guardian-session-build/{Shared,Schools} with Go 1.24 (GOOS=windows GOARCH=amd64 go build -buildvcs=false -trimpath -ldflags='-H windowsgui -s -w' -o MirsadChromeGuardian.exe .); run package.py.

Validation: PowerShell restore state tests, actual pause/closing handler tests, parsing both editions, native C# compile and x64 INPUT layout, Go embedded script/extraction/cleanup tests, PE GUI subsystem and hidden PowerShell launch flags. Live Windows/Chrome restoration and taskbar behavior are not exercised in this Linux environment; verify before customer distribution.

3.4.5 adds a two-item selector inside the existing 210x210 panel: restore the Chrome window/session (مرصاد ومدرستي) or open the dashboard URL without requesting restoration (مرصاد فقط). The preference is saved per edition under LOCALAPPDATA/MirsadGuardian. Default is session restoration; invalid/missing preferences safely fall back to that default. Switching modes clears the helper's pending restore attempt state and applies to subsequent recovery attempts. It does not undo a restoration command already sent to Chrome and does not close existing tabs. Chrome's own startup configuration can independently restore tabs.

Additional tests execute the actual selector event handler for both editions, verify preference persistence and corrupt-file handling, and prove dashboard-only mode never triggers the restore shortcut or --restore-last-session. Buttons are shifted five pixels downward and the status label is shortened to fit the selector within the existing panel size.
