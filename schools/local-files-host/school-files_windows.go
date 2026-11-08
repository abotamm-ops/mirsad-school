package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

func schoolArchiveRoot() string {
	return filepath.Join(os.Getenv("LOCALAPPDATA"), "MirsadSchoolsArchive")
}
func runSchoolNative(origin string) {
	_ = serveLocal(os.Stdin, os.Stdout, schoolArchiveRoot(), origin, func(path string) error {
		cmd := exec.Command(filepath.Join(os.Getenv("SystemRoot"), "explorer.exe"), path)
		return cmd.Start()
	})
}
func installSchoolNative() error {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		return errors.New("missing local application data")
	}
	dir := filepath.Join(base, "MirsadSchoolFilesHost")
	if e := os.MkdirAll(dir, 0700); e != nil {
		return e
	}
	source, e := os.Executable()
	if e != nil {
		return e
	}
	target := filepath.Join(dir, "MirsadChromeGuardian.exe")
	if source != target {
		b, e := os.ReadFile(source)
		if e != nil {
			return e
		}
		existing, _ := os.ReadFile(target)
		if !bytes.Equal(existing, b) {
			if e = localAtomic(target, b); e != nil {
				return e
			}
		}
	}
	manifest := map[string]interface{}{"name": "com.mirsad.school_files", "description": "School local evidence backup", "path": target, "type": "stdio", "allowed_origins": []string{schoolOrigin}}
	b, _ := json.Marshal(manifest)
	file := filepath.Join(dir, "host.json")
	if e = localAtomic(file, b); e != nil {
		return e
	}
	cmd := exec.Command(filepath.Join(os.Getenv("SystemRoot"), "System32", "reg.exe"), "add", `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.mirsad.school_files`, "/ve", "/t", "REG_SZ", "/d", file, "/f")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	return cmd.Run()
}
