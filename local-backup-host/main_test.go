package main

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func fixture(status string) request {
	image := "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte{137, 80, 78, 71, 13, 10, 26, 10})
	return request{Action: "save", Date: "2026-10-20", Filename: "معلم_غائب_ح1.png", Image: &image, Record: json.RawMessage(`{"scanId":"scan-1","status":"` + status + `","teacher":"المعلم","period":1}`)}
}
func roots(t *testing.T) [3]string { return [3]string{t.TempDir(), t.TempDir(), t.TempDir()} }
func TestMirrorsVerifiedImageAndJSON(t *testing.T) {
	j, e := validate(fixture("absent"))
	if e != nil {
		t.Fatal(e)
	}
	r := roots(t)
	a := copies(j, r, writeCopy, time.Second)
	if !a.OK || a.Fallback || len(a.Paths) != 2 {
		t.Fatal(a)
	}
	for _, p := range a.Paths {
		b, e := os.ReadFile(filepath.Join(p, j.name))
		if e != nil || !bytes.Equal(b, j.image) {
			t.Fatal(e)
		}
		if _, e := os.Stat(filepath.Join(p, j.recordName)); e != nil {
			t.Fatal(e)
		}
	}
	if x := copies(j, r, writeCopy, time.Second); !x.OK {
		t.Fatal(x)
	}
	conflict := j
	conflict.image = []byte("different")
	if x := writeCopy(r[0], conflict); x.err == nil {
		t.Fatal("overwrote existing evidence")
	}
}
func TestUnavailableAndHungDrivesFallbackToC(t *testing.T) {
	j, _ := validate(fixture("unresolved"))
	for _, failBoth := range []bool{false, true} {
		r := roots(t)
		bad := func(root string, j job) copyResult {
			if root == r[0] {
				return copyResult{err: errors.New("unavailable G")}
			}
			if root == r[1] && failBoth {
				time.Sleep(150 * time.Millisecond)
			}
			return writeCopy(root, j)
		}
		a := copies(j, r, bad, 10*time.Millisecond)
		if !a.OK || !a.Fallback || a.Paths[len(a.Paths)-1] != filepath.Join(r[2], "Data Copy", "توثيق غياب "+j.date) {
			t.Fatal(a)
		}
	}
}
func TestAllDisksFailDoesNotAcknowledge(t *testing.T) {
	j, _ := validate(fixture("absent"))
	a := copies(j, roots(t), func(string, job) copyResult { return copyResult{err: errors.New("disk failed")} }, time.Millisecond)
	if a.OK || len(a.Paths) != 0 || a.Error == "" {
		t.Fatal(a)
	}
}
func TestRejectsTraversalPresentPhotoAndInvalidPNG(t *testing.T) {
	for _, name := range []string{`..\a.png`, `C:\a.png`, `../a.png`, `CON.png`, `LPT1.png`, `a.png.`, `bad|name.png`} {
		r := fixture("absent")
		r.Filename = name
		if _, e := validate(r); e == nil {
			t.Fatal(name)
		}
	}
	if _, e := validate(fixture("present")); e == nil {
		t.Fatal("present photo accepted")
	}
	r := fixture("absent")
	v := "data:image/png;base64,eA=="
	r.Image = &v
	if _, e := validate(r); e == nil {
		t.Fatal("invalid PNG")
	}
	r = fixture("absent")
	r.Date = "2026-99-99"
	if _, e := validate(r); e == nil {
		t.Fatal("invalid date")
	}
}
func TestRefusesSymlinkAndRecordWithoutPhoto(t *testing.T) {
	r := roots(t)
	outside := t.TempDir()
	if e := os.Symlink(outside, filepath.Join(r[0], "Data Copy")); e == nil {
		if v := writeCopy(r[0], job{probe: true}); v.err == nil {
			t.Fatal("accepted redirected Data Copy")
		}
	}
	request := fixture("present")
	request.Image = nil
	j, e := validate(request)
	if e != nil {
		t.Fatal(e)
	}
	v := writeCopy(r[1], j)
	if v.err != nil {
		t.Fatal(v.err)
	}
	files, e := os.ReadDir(v.path)
	if e != nil || len(files) != 1 || filepath.Ext(files[0].Name()) != ".json" {
		t.Fatal(files, e)
	}
}
func TestNativeFramingRejectsBadInput(t *testing.T) {
	var in, out bytes.Buffer
	body := []byte(`{"action":"run-shell"}`)
	binary.Write(&in, binary.LittleEndian, uint32(len(body)))
	in.Write(body)
	if e := serve(&in, &out); e != nil {
		t.Fatal(e)
	}
	var n uint32
	binary.Read(&out, binary.LittleEndian, &n)
	var result response
	if e := json.Unmarshal(out.Bytes(), &result); e != nil || result.OK || result.Error == "" {
		t.Fatal(e, result)
	}
	in.Reset()
	binary.Write(&in, binary.LittleEndian, uint32(maxMessage+1))
	if e := serve(&in, &bytes.Buffer{}); e == nil {
		t.Fatal("oversized request accepted")
	}
}
