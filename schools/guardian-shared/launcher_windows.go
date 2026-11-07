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
	_, _, _ = dll.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x10)
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
	if err = installSchoolNative(); err != nil {
		showError("لم يكتمل تجهيز الحفظ المحلي للمدارس؛ النسخ داخل الإضافة تبقى للمحاولة. أغلق النسخة السابقة وأعد تشغيل التطبيق.\n" + err.Error())
		return
	}
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
	if pathErr == nil { cmd.Env = append(os.Environ(), "MIRSAD_GUARDIAN_LAUNCHER="+launcherPath) }
	// Hide the console only; the PowerShell WinForms control window stays visible.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err = cmd.Run(); err != nil {
		showError("تعذر تشغيل مساعد مرصاد. تأكد من توفر Windows PowerShell وصلاحية تشغيله.\n" + err.Error())
	}
}
