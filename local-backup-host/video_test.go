package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestVideoChunksVerifiedAndReplaySafe(t *testing.T) {
	root := t.TempDir()
	data := append([]byte{0x1a, 0x45, 0xdf, 0xa3}, bytes.Repeat([]byte{7}, 300000)...)
	h := sha256.Sum256(data)
	r := videoWriteRequest{ID: "job-1", Date: "2026-11-11", Filename: "teacher_job-1.webm", Size: int64(len(data)), SHA256: hex.EncodeToString(h[:]), Metadata: []byte(`{"teacher":"A"}`)}
	for offset := 0; offset < len(data); offset += 200000 {
		end := offset + 200000
		if end > len(data) {
			end = len(data)
		}
		r.Offset = int64(offset)
		r.Data = base64.StdEncoding.EncodeToString(data[offset:end])
		p, e := videoWrite(root, r)
		if e != nil {
			t.Fatal(e)
		}
		if end == len(data) {
			b, e := os.ReadFile(p)
			if e != nil || !bytes.Equal(b, data) {
				t.Fatal("bad final copy")
			}
			if _, e = videoWrite(root, r); e != nil {
				t.Fatal("final replay", e)
			}
		} else if p != "" {
			t.Fatal("claimed partial saved")
		}
	}
	if _, e := os.Stat(filepath.Join(root, "Videos", "2026-11-11", r.Filename+".json")); e != nil {
		t.Fatal(e)
	}
}
func TestVideoRejectsWrongHashTraversalAndRedirect(t *testing.T) {
	data := []byte{0x1a, 0x45, 0xdf, 0xa3, 7}
	h := sha256.Sum256(data)
	base := videoWriteRequest{ID: "id", Date: "2026-11-11", Filename: "teacher_id.webm", Size: int64(len(data)), SHA256: hex.EncodeToString(h[:]), Data: base64.StdEncoding.EncodeToString(data), Metadata: []byte(`{}`)}
	for _, change := range []func(*videoWriteRequest){func(r *videoWriteRequest) { r.Date = "../x" }, func(r *videoWriteRequest) { r.Filename = "../teacher_id.webm" }, func(r *videoWriteRequest) { r.SHA256 = string(bytes.Repeat([]byte{'0'}, 64)) }} {
		r := base
		change(&r)
		if _, e := videoWrite(t.TempDir(), r); e == nil {
			t.Fatal("invalid video accepted")
		}
	}
	root := t.TempDir()
	if e := os.Symlink(t.TempDir(), filepath.Join(root, "Videos")); e == nil {
		if _, e = videoWrite(root, base); e == nil {
			t.Fatal("followed symlink")
		}
	}
}
func TestVideoResetOnlySelectedDate(t *testing.T) {
	root := t.TempDir()
	for _, date := range []string{"2026-11-10", "2026-11-11"} {
		dir := filepath.Join(root, "Videos", date)
		os.MkdirAll(dir, 0700)
		os.WriteFile(filepath.Join(dir, "x.webm"), []byte("video"), 0600)
	}
	photos := filepath.Join(root, "توثيق غياب 2026-11-11")
	os.MkdirAll(photos, 0700)
	os.WriteFile(filepath.Join(photos, "x.png"), []byte("photo"), 0600)
	if e := videoReset(root, "2026-11-11"); e != nil {
		t.Fatal(e)
	}
	if _, e := os.Stat(filepath.Join(root, "Videos", "2026-11-11", "x.webm")); !os.IsNotExist(e) {
		t.Fatal("video not removed")
	}
	for _, path := range []string{filepath.Join(root, "Videos", "2026-11-10", "x.webm"), filepath.Join(photos, "x.png")} {
		if _, e := os.Stat(path); e != nil {
			t.Fatal("unrelated archive changed", e)
		}
	}
}
func TestVideoRangeDeleteKeepsOtherClipsSameDay(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "Videos", "2026-11-11")
	os.MkdirAll(dir, 0700)
	for _, name := range []string{"teacher_a.webm", "teacher_a.webm.json", "teacher_b.webm", ".video-a.part"} {
		os.WriteFile(filepath.Join(dir, name), []byte("data"), 0600)
	}
	if e := videoDelete(root, "2026-11-11", []string{"a"}); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"teacher_a.webm", "teacher_a.webm.json", ".video-a.part"} {
		if _, e := os.Stat(filepath.Join(dir, name)); !os.IsNotExist(e) {
			t.Fatal("selected retained", name)
		}
	}
	if _, e := os.Stat(filepath.Join(dir, "teacher_b.webm")); e != nil {
		t.Fatal("other clip removed")
	}
	if e := videoDelete(root, "2026-11-11", []string{"../b"}); e == nil {
		t.Fatal("unsafe ID accepted")
	}
}
