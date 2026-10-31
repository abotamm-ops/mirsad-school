package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestRecoveryMinuteAndStops(t *testing.T) {
	a := recoveryAttempts{}
	s := recoveryState{Running: true, At: 100000}
	if recoveryShouldOpen(s, 159999, &a) {
		t.Fatal("opened before a minute")
	}
	if !recoveryShouldOpen(s, 160000, &a) {
		t.Fatal("did not recover after a minute")
	}
	a.Last = 160000
	a.Count = 1
	if recoveryShouldOpen(s, 219999, &a) {
		t.Fatal("relaunch loop")
	}
	a.Count = 3
	if recoveryShouldOpen(s, 300000, &a) {
		t.Fatal("unbounded retries")
	}
	s.At = 250000
	if !recoveryShouldOpen(s, 310000, &a) {
		t.Fatal("fresh heartbeat did not reset attempts")
	}
	s.Running = false
	if recoveryShouldOpen(s, 400000, &a) {
		t.Fatal("reopened stopped/paused task")
	}
	s.Running = true
	if recoveryShouldOpen(s, s.At+13*60*60*1000, &a) {
		t.Fatal("stale task reopened after reboot")
	}
	if recoveryShouldOpen(s, s.At-1, &a) {
		t.Fatal("future heartbeat accepted")
	}
}
func TestRecoveryStateIsAtomicAndKeepsLatestStop(t *testing.T) {
	dir := t.TempDir()
	if e := writeRecoveryState(dir, recoveryState{Running: true, At: 1}); e != nil {
		t.Fatal(e)
	}
	if e := writeRecoveryState(dir, recoveryState{Running: false, At: 2}); e != nil {
		t.Fatal(e)
	}
	b, e := os.ReadFile(filepath.Join(dir, "browser-state.json"))
	var s recoveryState
	if e != nil || json.Unmarshal(b, &s) != nil || s.Running || s.At != 2 {
		t.Fatal("stop not persisted")
	}
	if recoveryRequest(request{}, "chrome-extension://other/").OK {
		t.Fatal("other extension armed school watchdog")
	}
}

func TestClosedWindowRecoversEvenWithBackgroundHeartbeats(t *testing.T) {
	a := recoveryAttempts{}
	s := recoveryState{Running: true, At: 150000, MissingSince: 100000}
	if recoveryShouldOpen(s, 159999, &a) {
		t.Fatal("early reopen")
	}
	s.At = 160000
	if !recoveryShouldOpen(s, 160000, &a) {
		t.Fatal("background Chrome prevented recovery")
	}
	a.Count = 3
	s.At = 180000
	if recoveryShouldOpen(s, 180000, &a) {
		t.Fatal("background heartbeat reset retry limit")
	}
}
