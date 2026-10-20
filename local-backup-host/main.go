// Mirsad native messaging host: fixed backup roots only, no network or shell access.
package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const maxMessage = 32 * 1024 * 1024

type request struct {
	Action   string          `json:"action"`
	Date     string          `json:"date"`
	Filename string          `json:"filename"`
	Image    *string         `json:"image"`
	Record   json.RawMessage `json:"record"`
}
type job struct {
	date, name, recordName string
	image, record          []byte
	probe                  bool
}
type copyResult struct {
	path string
	err  error
}
type response struct {
	OK       bool     `json:"ok"`
	Paths    []string `json:"paths"`
	Fallback bool     `json:"fallback"`
	Errors   []string `json:"errors,omitempty"`
	Error    string   `json:"error,omitempty"`
}

func digest(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func validName(name string) bool {
	if name == "" || len([]rune(name)) > 180 || strings.ContainsAny(name, "\\/:*?\"<>|\x00") || !strings.HasSuffix(strings.ToLower(name), ".png") || strings.TrimRight(name, " .") != name {
		return false
	}
	for _, c := range name {
		if c < 32 {
			return false
		}
	}
	stem := strings.ToUpper(strings.Split(name, ".")[0])
	if stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL" {
		return false
	}
	if len(stem) == 4 && (strings.HasPrefix(stem, "COM") || strings.HasPrefix(stem, "LPT")) && stem[3] >= '1' && stem[3] <= '9' {
		return false
	}
	return true
}
func validate(r request) (job, error) {
	if r.Action == "probe" {
		return job{probe: true}, nil
	}
	if r.Action != "save" {
		return job{}, errors.New("unsupported action")
	}
	day, err := time.Parse("2006-01-02", r.Date)
	if err != nil || day.Format("2006-01-02") != r.Date {
		return job{}, errors.New("invalid date")
	}
	var record struct {
		ScanID string `json:"scanId"`
		Status string `json:"status"`
	}
	if json.Unmarshal(r.Record, &record) != nil || len(record.ScanID) == 0 || len(record.ScanID) > 512 {
		return job{}, errors.New("invalid scan record")
	}
	switch record.Status {
	case "present", "absent", "unresolved", "late", "no-link":
	default:
		return job{}, errors.New("invalid status")
	}
	j := job{date: r.Date, record: r.Record, recordName: "result-" + digest([]byte(record.ScanID)) + ".json"}
	if r.Image != nil && *r.Image != "" {
		if record.Status != "absent" && record.Status != "unresolved" {
			return job{}, errors.New("present photographs prohibited")
		}
		const prefix = "data:image/png;base64,"
		if !strings.HasPrefix(*r.Image, prefix) {
			return job{}, errors.New("only PNG evidence accepted")
		}
		image, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(*r.Image, prefix))
		if err != nil || len(image) < 8 || len(image) > 16*1024*1024 || !bytes.Equal(image[:8], []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
			return job{}, errors.New("invalid PNG evidence")
		}
		if !validName(r.Filename) {
			return job{}, errors.New("invalid filename")
		}
		j.image = image
		j.name = r.Filename
		j.recordName = r.Filename + ".json"
	}
	return j, nil
}
func atomicWrite(path string, data []byte) error {
	if old, err := os.ReadFile(path); err == nil {
		if bytes.Equal(old, data) {
			return nil
		}
		return errors.New("conflicting existing backup; retained original")
	} else if !os.IsNotExist(err) {
		return err
	}
	var token [12]byte
	if _, err := rand.Read(token[:]); err != nil {
		return err
	}
	temp := path + "." + hex.EncodeToString(token[:]) + ".tmp"
	f, err := os.OpenFile(temp, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	defer os.Remove(temp)
	_, writeErr := f.Write(data)
	if writeErr == nil {
		writeErr = f.Sync()
	}
	closeErr := f.Close()
	if writeErr != nil {
		return writeErr
	}
	if closeErr != nil {
		return closeErr
	}
	stored, err := os.ReadFile(temp)
	if err != nil {
		return err
	}
	if digest(stored) != digest(data) {
		return errors.New("backup verification failed")
	}
	// Link creates the destination exclusively, never overwriting an existing file.
	// Windows/NTFS and Linux both support it; removable FAT/exFAT use exclusive copy.
	if err := os.Link(temp, path); err == nil {
		return nil
	}
	// FAT/exFAT: rename the verified temporary file on the same volume.
	if old, err := os.ReadFile(path); err == nil {
		if bytes.Equal(old, data) {
			return nil
		}
		return errors.New("conflicting existing backup; retained original")
	} else if !os.IsNotExist(err) {
		return err
	}
	return os.Rename(temp, path)
}
func safeFolder(path string) error {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
		return errors.New("backup folder is redirected or not a directory")
	}
	return nil
}
func writeCopy(root string, j job) copyResult {
	fail := func(err error) copyResult { return copyResult{err: fmt.Errorf("%s: %w", root, err)} }
	info, err := os.Stat(root)
	if err != nil {
		return fail(err)
	}
	if !info.IsDir() {
		return fail(errors.New("drive is not a directory"))
	}
	base := filepath.Join(root, "Data Copy")
	if err := safeFolder(base); err != nil {
		return fail(err)
	}
	folder := base
	if !j.probe {
		folder = filepath.Join(base, "توثيق غياب "+j.date)
	}
	if err := safeFolder(folder); err != nil {
		return fail(err)
	}
	if err := os.MkdirAll(folder, 0700); err != nil {
		return fail(err)
	}
	if j.probe {
		f, err := os.CreateTemp(folder, ".mirsad-check-")
		if err != nil {
			return fail(err)
		}
		name := f.Name()
		if _, err := f.Write([]byte("Mirsad backup write check")); err != nil {
			f.Close()
			os.Remove(name)
			return fail(err)
		}
		if err := f.Sync(); err != nil {
			f.Close()
			os.Remove(name)
			return fail(err)
		}
		if err := f.Close(); err != nil {
			os.Remove(name)
			return fail(err)
		}
		os.Remove(name)
	} else {
		if j.image != nil {
			if err := atomicWrite(filepath.Join(folder, j.name), j.image); err != nil {
				return fail(err)
			}
		}
		if err := atomicWrite(filepath.Join(folder, j.recordName), j.record); err != nil {
			return fail(err)
		}
	}
	return copyResult{path: folder}
}
func copies(j job, roots [3]string, write func(string, job) copyResult, timeout time.Duration) response {
	start := func(root string) <-chan copyResult {
		ch := make(chan copyResult, 1)
		go func() { ch <- write(root, j) }()
		return ch
	}
	wait := func(ch <-chan copyResult, root string) copyResult {
		select {
		case result := <-ch:
			return result
		case <-time.After(timeout):
			return copyResult{err: fmt.Errorf("%s: drive timed out", root)}
		}
	}
	g, k := start(roots[0]), start(roots[1])
	first, second := wait(g, roots[0]), wait(k, roots[1])
	results := []copyResult{first, second}
	fallback := first.err != nil || second.err != nil
	ok := !fallback
	if fallback {
		c := wait(start(roots[2]), roots[2])
		results = append(results, c)
		ok = c.err == nil
	}
	r := response{OK: ok, Fallback: fallback, Paths: []string{}}
	for _, result := range results {
		if result.err != nil {
			r.Errors = append(r.Errors, result.err.Error())
		} else {
			r.Paths = append(r.Paths, result.path)
		}
	}
	if !ok {
		r.Error = strings.Join(r.Errors, "; ")
	}
	return r
}
func execute(r request) response {
	j, err := validate(r)
	if err != nil {
		return response{Error: err.Error()}
	}
	return copies(j, [3]string{`G:\`, `K:\`, `C:\`}, writeCopy, 2*time.Second)
}
func serve(input io.Reader, output io.Writer) error {
	var size uint32
	if err := binary.Read(input, binary.LittleEndian, &size); err != nil {
		return err
	}
	if size == 0 || size > maxMessage {
		return errors.New("invalid message size")
	}
	data := make([]byte, size)
	if _, err := io.ReadFull(input, data); err != nil {
		return err
	}
	var r request
	var result response
	if err := json.Unmarshal(data, &r); err != nil {
		result.Error = "invalid request JSON"
	} else {
		result = execute(r)
	}
	body, err := json.Marshal(result)
	if err != nil {
		return err
	}
	if err = binary.Write(output, binary.LittleEndian, uint32(len(body))); err != nil {
		return err
	}
	_, err = output.Write(body)
	return err
}
func main() {
	if err := serve(os.Stdin, os.Stdout); err != nil {
		body, _ := json.Marshal(response{Error: err.Error()})
		binary.Write(os.Stdout, binary.LittleEndian, uint32(len(body)))
		os.Stdout.Write(body)
	}
}
