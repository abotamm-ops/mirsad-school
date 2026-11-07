package main

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const testSchool = "12345678-1234-1234-1234-123456789abc"

func TestLocalMirror(t *testing.T) {
	root := filepath.Join(t.TempDir(), "archive")
	record := json.RawMessage(`{"scanId":"scan-1","teacher":"<script>bad</script>","status":"absent"}`)
	r := localRequest{Action: "save", School: testSchool, Date: "2026-11-07", Record: record, Image: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte{137, 80, 78, 71, 13, 10, 26, 10, 1})}
	reply := handleLocal(root, schoolOrigin, r, func(string) error { return nil })
	if !reply.OK || !reply.Verified {
		t.Fatal(reply)
	}
	image := filepath.Join(reply.Path, "image-"+localHash([]byte("scan-1"))+".png")
	if b, e := os.ReadFile(image); e != nil || len(b) != 9 {
		t.Fatal("missing saved image", e)
	}
	html, e := os.ReadFile(filepath.Join(reply.Path, "index.html"))
	if e != nil || strings.Contains(string(html), "<script>bad</script>") {
		t.Fatal("unsafe archive HTML")
	}
	if !bytes.Contains(html, []byte("فتح الصورة")) {
		t.Fatal("missing image link")
	}
	snapshot := localRequest{Action: "snapshot", School: testSchool, Date: r.Date, Data: json.RawMessage(`{"snapshot":{"date":"2026-11-07"},"records":[],"accessToken":"must-not-be-saved"}`)}
	if v := handleLocal(root, schoolOrigin, snapshot, func(string) error { return nil }); !v.OK {
		t.Fatal(v)
	}
	b, _ := os.ReadFile(filepath.Join(reply.Path, "day.json"))
	if bytes.Contains(b, []byte("must-not-be-saved")) {
		t.Fatal("credential in local mirror")
	}
}
func TestLocalScopeAndValidation(t *testing.T) {
	for _, v := range []struct {
		origin string
		r      localRequest
	}{{"chrome-extension://other/", localRequest{Action: "probe"}}, {schoolOrigin, localRequest{Action: "save", School: "../escape", Date: "2026-11-07"}}, {schoolOrigin, localRequest{Action: "snapshot", School: testSchool, Date: "2026-11-07", Data: json.RawMessage(`{"snapshot":{"date":"2026-11-06"}}`)}}, {schoolOrigin, localRequest{Action: "save", School: testSchool, Date: "2026-11-07", Record: json.RawMessage(`{"scanId":"x","status":"present"}`), Image: "data:image/png;base64,AAA="}}} {
		r := handleLocal(t.TempDir(), v.origin, v.r, func(string) error { return nil })
		if r.OK {
			t.Fatal("accepted invalid request", v)
		}
	}
}
func TestNativeFraming(t *testing.T) {
	var input, output bytes.Buffer
	b, _ := json.Marshal(localRequest{Action: "probe"})
	_ = binary.Write(&input, binary.LittleEndian, uint32(len(b)))
	input.Write(b)
	if e := serveLocal(&input, &output, t.TempDir(), schoolOrigin, func(string) error { return nil }); e != nil {
		t.Fatal(e)
	}
	var size uint32
	_ = binary.Read(&output, binary.LittleEndian, &size)
	var r localResponse
	if e := json.Unmarshal(output.Next(int(size)), &r); e != nil || !r.OK {
		t.Fatal(r, e)
	}
}
func TestRejectSymlink(t *testing.T) {
	root := t.TempDir()
	target := t.TempDir()
	if e := os.Symlink(target, filepath.Join(root, "school-"+testSchool)); e != nil {
		t.Skip(e)
	}
	r := handleLocal(root, schoolOrigin, localRequest{Action: "save", School: testSchool, Date: "2026-11-07", Record: json.RawMessage(`{"scanId":"x","status":"absent"}`)}, func(string) error { return nil })
	if r.OK {
		t.Fatal("followed redirected school folder")
	}
}
