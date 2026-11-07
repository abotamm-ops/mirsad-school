package main

import (
	"os"
	"os/exec"
	"path/filepath"
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
	args, err := validatedArguments(os.Args[1:])
	if err != nil {
		showError(err.Error())
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
	// Hide the console only; the PowerShell WinForms control window stays visible.
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	if err = cmd.Run(); err != nil {
		showError("تعذر تشغيل مساعد مرصاد. تأكد من توفر Windows PowerShell وصلاحية تشغيله.\n" + err.Error())
	}
}
