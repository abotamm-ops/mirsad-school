package main

import (
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const schoolExtension = "mdkhgdcnfibnemhiklpejojajjajhcbg"
const recoveryURL = "https://mirsad-school.onrender.com/automatic-monitoring.html"

type recoveryState struct {
	MissingSince int64 `json:"missingSince"`
	Running      bool  `json:"running"`
	At           int64 `json:"at"`
}
type recoveryConfig struct {
	ChromePath  string `json:"chromePath"`
	Profile     string `json:"profile"`
	ExtensionID string `json:"extensionId"`
}
type recoveryAttempts struct {
	Seen  int64
	Count int
	Last  int64
}

func recoveryDir() (string, error) {
	root := os.Getenv("LOCALAPPDATA")
	if root == "" {
		return "", errors.New("Windows local application folder unavailable")
	}
	return filepath.Join(root, "Mirsad", "LocalBackup"), nil
}
func readRecoveryConfig(dir string) (recoveryConfig, error) {
	var c recoveryConfig
	b, e := os.ReadFile(filepath.Join(dir, "browser-recovery.json"))
	if e != nil {
		return c, e
	}
	if e = json.Unmarshal(b, &c); e != nil {
		return c, e
	}
	if c.ExtensionID != schoolExtension || !regexp.MustCompile(`^(Default|Profile [0-9]+)$`).MatchString(c.Profile) || !strings.EqualFold(filepath.Base(c.ChromePath), "chrome.exe") || !filepath.IsAbs(c.ChromePath) {
		return c, errors.New("invalid browser recovery configuration")
	}
	if _, e = os.Stat(c.ChromePath); e != nil {
		return c, e
	}
	return c, nil
}
func recoveryShouldOpen(s recoveryState, now int64, a *recoveryAttempts) bool {
	base := s.At
	if s.MissingSince > 0 {
		base = s.MissingSince
	}
	if base != a.Seen {
		a.Seen = base
		a.Count = 0
		a.Last = 0
	}
	if !s.Running || s.At > now || now-base < 60000 || now-s.At > 12*60*60*1000 || a.Count >= 3 || a.Last > 0 && now-a.Last < 60000 {
		return false
	}
	return true
}
func writeRecoveryState(dir string, s recoveryState) error {
	b, e := json.Marshal(s)
	if e != nil {
		return e
	}
	tmp, e := os.CreateTemp(dir, "browser-state-*.tmp")
	if e != nil {
		return e
	}
	name := tmp.Name()
	defer os.Remove(name)
	if _, e = tmp.Write(b); e != nil {
		tmp.Close()
		return e
	}
	if e = tmp.Close(); e != nil {
		return e
	}
	return os.Rename(name, filepath.Join(dir, "browser-state.json"))
}
func recoveryRequest(r request, origin string) response {
	if origin != "chrome-extension://"+schoolExtension+"/" {
		return response{Error: "browser recovery is restricted to the school extension"}
	}
	dir, e := recoveryDir()
	if e != nil {
		return response{Error: e.Error()}
	}
	if _, e = readRecoveryConfig(dir); e != nil {
		return response{Error: "install the updated school browser recovery helper"}
	}
	if r.Running == nil || r.WindowOpen == nil {
		return response{Error: "missing browser recovery state"}
	}
	now := time.Now().UnixMilli()
	state := recoveryState{Running: *r.Running, At: now}
	if state.Running && !*r.WindowOpen {
		var old recoveryState
		b, _ := os.ReadFile(filepath.Join(dir, "browser-state.json"))
		json.Unmarshal(b, &old)
		state.MissingSince = now
		if old.Running && old.MissingSince > 0 {
			state.MissingSince = old.MissingSince
		}
	}
	if e = writeRecoveryState(dir, state); e != nil {
		return response{Error: e.Error()}
	}
	b, err := os.ReadFile(filepath.Join(dir, "browser-worker.json"))
	var worker struct {
		At int64 `json:"at"`
	}
	if err != nil || json.Unmarshal(b, &worker) != nil || now-worker.At > 20000 {
		return response{Error: "browser recovery worker is not running; run Install.cmd"}
	}
	return response{OK: true, BrowserRecoverySupport: true}
}
func recoveryLoop() error {
	dir, e := recoveryDir()
	if e != nil {
		return e
	}
	c, e := readRecoveryConfig(dir)
	if e != nil {
		return e
	}
	a := recoveryAttempts{}
	for {
		alive, _ := json.Marshal(map[string]int64{"at": time.Now().UnixMilli()})
		os.WriteFile(filepath.Join(dir, "browser-worker.json"), alive, 0600)
		b, e := os.ReadFile(filepath.Join(dir, "browser-state.json"))
		var s recoveryState
		if e == nil && json.Unmarshal(b, &s) == nil && recoveryShouldOpen(s, time.Now().UnixMilli(), &a) {
			// Re-read immediately before launch so an explicit stop supersedes a pending restart.
			var current recoveryState
			b, e = os.ReadFile(filepath.Join(dir, "browser-state.json"))
			if e == nil && json.Unmarshal(b, &current) == nil && current == s {
				a.Count++
				a.Last = time.Now().UnixMilli()
				cmd := exec.Command(c.ChromePath, "--profile-directory="+c.Profile, "--new-window", recoveryURL)
				err := cmd.Start()
				if err == nil {
					go cmd.Wait()
				}
				event := map[string]any{"at": a.Last, "attempt": a.Count, "ok": err == nil}
				if err != nil {
					event["error"] = err.Error()
				}
				data, _ := json.Marshal(event)
				os.WriteFile(filepath.Join(dir, "browser-last-recovery.json"), data, 0600)
			}
		}
		time.Sleep(5 * time.Second)
	}
}
