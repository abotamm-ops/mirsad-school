package main

import (
	"embed"
	"os"
	"path/filepath"
)

//go:embed MirsadChromeGuardian.ps1
var scripts embed.FS

// Use a fresh directory for each launch; never reuse or overwrite a user script.
func prepareScript() (string, func(), error) {
	dir, err := os.MkdirTemp("", "mirsad-chrome-guardian-")
	if err != nil {
		return "", func() {}, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	body, err := scripts.ReadFile("MirsadChromeGuardian.ps1")
	if err != nil {
		cleanup()
		return "", func() {}, err
	}
	path := filepath.Join(dir, "MirsadChromeGuardian.ps1")
	if err = os.WriteFile(path, body, 0600); err != nil {
		cleanup()
		return "", func() {}, err
	}
	return path, cleanup, nil
}
