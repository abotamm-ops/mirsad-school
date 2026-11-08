package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

func showError(message string) {
	dll := syscall.NewLazyDLL("user32.dll")
	title, _ := syscall.UTF16PtrFromString("مساعد مرصاد")
	body, _ := syscall.UTF16PtrFromString(message)
	_, _, _ = dll.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x50010)
}

func main() {
	if len(os.Args) > 1 && strings.HasPrefix(os.Args[1], "chrome-extension://") {
		runSchoolNative(os.Args[1])
		return
	}
	args, err := validatedArguments(os.Args[1:])
	if err != nil {
		showError(err.Error())
		return
	}
	logDir := filepath.Join(os.Getenv("LOCALAPPDATA"), "MirsadGuardian")
	_ = os.MkdirAll(logDir, 0700)
	logPath := filepath.Join(logDir, "last-start.log")
	warning := ""
	if err = installSchoolNative(); err != nil {
		warning = "Local school backup setup: " + err.Error() + "\n"
	}
	_ = os.WriteFile(logPath, []byte(warning+"Starting guardian 3.2.1\n"), 0600)
	path, cleanup, err := prepareScript()
	if err != nil {
		showError("تعذر تجهيز مساعد مرصاد: " + err.Error())
		return
	}
	defer cleanup()
	powershell := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	commandArgs := append([]string{"-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", path}, args...)
	cmd := exec.Command(powershell, commandArgs...)
	launcherPath, pathErr := os.Executable()
	if pathErr == nil {
		cmd.Env = append(os.Environ(), "MIRSAD_GUARDIAN_LAUNCHER="+launcherPath, "MIRSAD_GUARDIAN_LOG="+logPath)
	}
	// Hide the console only; the PowerShell WinForms control window stays visible.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	output, runErr := cmd.CombinedOutput()
	if runErr != nil {
		f, e := os.OpenFile(logPath, os.O_APPEND|os.O_WRONLY, 0600)
		if e == nil {
			_, _ = f.Write(output)
			_, _ = f.WriteString("\n" + runErr.Error())
			_ = f.Close()
		}
		detail := string(output)
		if len(detail) > 1800 {
			detail = detail[len(detail)-1800:]
		}
		showError("تعذر بدء المساعد. تفاصيل الخطأ محفوظة في:\n" + logPath + "\n\n" + detail)
	}
}
