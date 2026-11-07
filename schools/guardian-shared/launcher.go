package main

import (
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

//go:embed MirsadChromeGuardian.ps1 Guardian-Selection.ps1
var scripts embed.FS

// Use a fresh directory for each launch; never reuse or overwrite a user script.
func prepareScript() (string, func(), error) {
	dir, err := os.MkdirTemp("", "mirsad-chrome-guardian-")
	if err != nil {
		return "", func() {}, err
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	path := filepath.Join(dir, "MirsadChromeGuardian.ps1")
	for _, name := range []string{"MirsadChromeGuardian.ps1", "Guardian-Selection.ps1"} {
		body, readErr := scripts.ReadFile(name)
		if readErr != nil {
			cleanup()
			return "", func() {}, readErr
		}
		if err = os.WriteFile(filepath.Join(dir, name), body, 0600); err != nil {
			cleanup()
			return "", func() {}, err
		}
	}
	return path, cleanup, nil
}

func validatedArguments(args []string) ([]string, error) {
	result := []string{}
	seen := map[string]bool{}
	for i := 0; i < len(args); i += 2 {
		if i+1 >= len(args) || seen[args[i]] {
			return nil, fmt.Errorf("خيارات تشغيل غير مكتملة")
		}
		seen[args[i]] = true
		switch args[i] {
		case "-Edition":
			if args[i+1] != "Auto" && args[i+1] != "Private" && args[i+1] != "Schools" {
				return nil, fmt.Errorf("النسخة غير صحيحة")
			}
		case "-Profile":
			if !regexp.MustCompile(`^(Default|Profile [0-9]+)$`).MatchString(args[i+1]) {
				return nil, fmt.Errorf("ملف Chrome غير صحيح")
			}
		default:
			return nil, fmt.Errorf("خيار غير معروف")
		}
		result = append(result, args[i], args[i+1])
	}
	return result, nil
}
