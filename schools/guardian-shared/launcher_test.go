package main

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestEmbeddedScriptAndCleanup(t *testing.T) {
	path, cleanup, err := prepareScript()
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	expected, _ := scripts.ReadFile("MirsadChromeGuardian.ps1")
	if !bytes.Equal(body, expected) {
		t.Fatal("embedded script changed")
	}
	if !bytes.HasPrefix(body, []byte{0xef, 0xbb, 0xbf}) {
		t.Fatal("Windows PowerShell Arabic needs UTF-8 BOM")
	}
	if _, err = os.Stat(filepath.Join(filepath.Dir(path), "Guardian-Selection.ps1")); err != nil {
		t.Fatal("missing selection module", err)
	}
	for _, marker := range []string{"System.Windows.Forms.Form", "إيقاف وإغلاق", "$form.add_Shown", "$form.add_FormClosing", "KeepAwake($false)"} {
		if !bytes.Contains(body, []byte(marker)) {
			t.Fatal("missing lifecycle action: " + marker)
		}
	}
	cleanup()
	if _, err = os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("temporary script survived exit")
	}
}

func TestLaunchArguments(t *testing.T) {
	for _, args := range [][]string{nil, {"-Edition", "Schools"}, {"-Edition", "Private", "-Profile", "Profile 2"}} {
		if _, err := validatedArguments(args); err != nil {
			t.Fatal(args, err)
		}
	}
	for _, args := range [][]string{{"-Edition", "Other"}, {"-Profile", "Default; Start-Process anything"}, {"-URL", "https://other.test"}, {"-Edition"}, {"-Edition", "Schools", "-Edition", "Private"}} {
		if _, err := validatedArguments(args); err == nil {
			t.Fatal("accepted invalid launch", args)
		}
	}
}
