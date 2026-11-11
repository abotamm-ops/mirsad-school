package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type videoWriteRequest struct {
	ID       string          `json:"id"`
	Date     string          `json:"date"`
	Filename string          `json:"filename"`
	Offset   int64           `json:"offset"`
	Size     int64           `json:"size"`
	SHA256   string          `json:"sha256"`
	Data     string          `json:"data"`
	Metadata json.RawMessage `json:"metadata"`
}

func videoRegular(path string) error {
	st, e := os.Lstat(path)
	if e != nil {
		return e
	}
	if !st.Mode().IsRegular() || st.Mode()&os.ModeSymlink != 0 {
		return errors.New("video file redirected")
	}
	return nil
}
func videoDirs(root, target string) error {
	rel, e := filepath.Rel(root, target)
	if e != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return errors.New("invalid video directory")
	}
	// The fixed archive root is trusted; each child must be a real directory.
	if e = os.MkdirAll(root, 0700); e != nil {
		return e
	}
	parts := []string{root}
	for _, p := range strings.Split(rel, string(filepath.Separator)) {
		if p != "." && p != "" {
			parts = append(parts, filepath.Join(parts[len(parts)-1], p))
		}
	}
	for _, p := range parts {
		if e = os.Mkdir(p, 0700); e != nil && !os.IsExist(e) {
			return e
		}
		st, err := os.Lstat(p)
		if err != nil {
			return err
		}
		if !st.IsDir() || st.Mode()&os.ModeSymlink != 0 {
			return errors.New("video directory redirected")
		}
	}
	return nil
}
func videoHash(path string) (string, error) {
	if e := videoRegular(path); e != nil {
		return "", e
	}
	f, e := os.Open(path)
	if e != nil {
		return "", e
	}
	defer f.Close()
	h := sha256.New()
	if _, e = io.Copy(h, f); e != nil {
		return "", e
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
func videoMetadata(path string, b []byte) error {
	if old, e := os.ReadFile(path); e == nil {
		if e = videoRegular(path); e != nil {
			return e
		}
		if !bytes.Equal(old, b) {
			return errors.New("video metadata conflicts")
		}
		return nil
	} else if !os.IsNotExist(e) {
		return e
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	_, e = f.Write(b)
	ce := f.Close()
	if e != nil {
		return e
	}
	return ce
}
func videoWrite(root string, r videoWriteRequest) (string, error) {
	day, e := time.Parse("2006-01-02", r.Date)
	if e != nil || day.Format("2006-01-02") != r.Date {
		return "", errors.New("invalid video date")
	}
	if !regexp.MustCompile(`^[A-Za-z0-9-]{1,80}$`).MatchString(r.ID) || !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(r.SHA256) {
		return "", errors.New("invalid video identity")
	}
	if r.Size < 1 || r.Size > 200*1024*1024 || r.Offset < 0 || r.Offset >= r.Size || len(r.Filename) > 500 || strings.ContainsAny(r.Filename, "\\/:*?\"<>|\x00") || !strings.HasSuffix(r.Filename, "_"+r.ID+".webm") || strings.ContainsAny(r.Filename, "\r\n\t") {
		return "", errors.New("invalid video filename or size")
	}
	data, e := base64.StdEncoding.DecodeString(r.Data)
	if e != nil || len(data) < 1 || len(data) > 256*1024 || r.Offset+int64(len(data)) > r.Size {
		return "", errors.New("invalid video chunk")
	}
	if r.Offset == 0 && !bytes.HasPrefix(data, []byte{0x1a, 0x45, 0xdf, 0xa3}) {
		return "", errors.New("only WebM video accepted")
	}
	if len(r.Metadata) > 64000 || !json.Valid(r.Metadata) {
		return "", errors.New("invalid video metadata")
	}
	dir := filepath.Join(root, "Videos", r.Date)
	if e = videoDirs(root, dir); e != nil {
		return "", e
	}
	dest := filepath.Join(dir, r.Filename)
	if st, err := os.Lstat(dest); err == nil {
		h, e := videoHash(dest)
		if e == nil && st.Size() == r.Size && h == r.SHA256 {
			if e = videoMetadata(dest+".json", r.Metadata); e != nil {
				return "", e
			}
			if e = videoIndex(dir); e != nil {
				return "", e
			}
			return dest, nil
		}
		return "", errors.New("existing video conflicts; original retained")
	} else if !os.IsNotExist(err) {
		return "", err
	}
	part := filepath.Join(dir, ".video-"+r.ID+".part")
	meta := part + ".json"
	clean := r
	clean.Data = ""
	clean.Offset = 0
	expected, _ := json.Marshal(clean)
	if old, err := os.ReadFile(meta); err == nil {
		if e = videoRegular(meta); e != nil {
			return "", e
		}
		if !bytes.Equal(old, expected) {
			return "", errors.New("video upload metadata changed")
		}
	} else if os.IsNotExist(err) {
		f, e := os.OpenFile(meta, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if e != nil {
			return "", e
		}
		_, e = f.Write(expected)
		ce := f.Close()
		if e != nil {
			return "", e
		}
		if ce != nil {
			return "", ce
		}
	} else {
		return "", err
	}
	if _, err := os.Lstat(part); err == nil {
		if e = videoRegular(part); e != nil {
			return "", e
		}
	} else if !os.IsNotExist(err) {
		return "", err
	}
	f, e := os.OpenFile(part, os.O_CREATE|os.O_RDWR, 0600)
	if e != nil {
		return "", e
	}
	defer f.Close()
	st, e := f.Stat()
	if e != nil {
		return "", e
	}
	end := r.Offset + int64(len(data))
	if st.Size() == r.Offset {
		if _, e = f.WriteAt(data, r.Offset); e != nil {
			return "", e
		}
		if e = f.Sync(); e != nil {
			return "", e
		}
	} else if st.Size() >= end {
		old := make([]byte, len(data))
		if _, e = f.ReadAt(old, r.Offset); e != nil || !bytes.Equal(old, data) {
			return "", errors.New("video chunk conflicts")
		}
	} else if st.Size() > r.Offset && st.Size() < end {
		old := make([]byte, st.Size()-r.Offset)
		if _, e = f.ReadAt(old, r.Offset); e != nil || !bytes.Equal(old, data[:len(old)]) {
			return "", errors.New("partial video chunk conflicts")
		}
		if _, e = f.WriteAt(data, r.Offset); e != nil {
			return "", e
		}
		if e = f.Sync(); e != nil {
			return "", e
		}
	} else {
		return "", errors.New("video chunk offset mismatch")
	}
	if end != r.Size {
		return "", nil
	}
	if e = f.Close(); e != nil {
		return "", e
	}
	h, e := videoHash(part)
	if e != nil {
		return "", e
	}
	if h != r.SHA256 {
		return "", errors.New("video verification failed")
	}
	// Exclusive destination creation; never replace another archived recording.
	source, e := os.Open(part)
	if e != nil {
		return "", e
	}
	defer source.Close()
	target, e := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if e != nil {
		return "", e
	}
	_, e = io.Copy(target, source)
	source.Close()
	if e == nil {
		e = target.Sync()
	}
	ce := target.Close()
	if e != nil || ce != nil {
		os.Remove(dest)
		if e != nil {
			return "", e
		}
		return "", ce
	}
	verified, e := videoHash(dest)
	if e != nil || verified != r.SHA256 {
		os.Remove(dest)
		return "", errors.New("video readback verification failed")
	}
	if e = videoMetadata(dest+".json", r.Metadata); e != nil {
		return "", fmt.Errorf("video saved but index pending: %w", e)
	}
	os.Remove(part)
	os.Remove(meta)
	if e = videoIndex(dir); e != nil {
		return "", e
	}
	return dest, nil
}

func videoReset(root, date string) error {
	d, e := time.Parse("2006-01-02", date)
	if e != nil || d.Format("2006-01-02") != date {
		return errors.New("invalid video reset date")
	}
	dir := filepath.Join(root, "Videos", date)
	if _, e = os.Lstat(dir); os.IsNotExist(e) {
		return nil
	}
	if e = videoDirs(root, dir); e != nil {
		return e
	}
	entries, e := os.ReadDir(dir)
	if e != nil {
		return e
	}
	for _, entry := range entries {
		if entry.IsDir() || entry.Type()&os.ModeSymlink != 0 {
			return errors.New("video archive redirected")
		}
		name := entry.Name()
		if strings.HasSuffix(name, ".webm") || strings.HasSuffix(name, ".json") || strings.HasSuffix(name, ".part") {
			if e = os.Remove(filepath.Join(dir, name)); e != nil {
				return e
			}
		}
	}
	return videoIndex(dir)
}

func videoIndex(dir string) error {
	entries, e := os.ReadDir(dir)
	if e != nil {
		return e
	}
	type row struct {
		Teacher  string `json:"teacher"`
		Period   int    `json:"period"`
		Cycle    int    `json:"afterCycle"`
		Duration int    `json:"durationMs"`
		Filename string `json:"filename"`
		URL      string `json:"-"`
	}
	rows := []row{}
	for _, entry := range entries {
		if !strings.HasSuffix(entry.Name(), ".webm.json") {
			continue
		}
		if e = videoRegular(filepath.Join(dir, entry.Name())); e != nil {
			return e
		}
		b, e := os.ReadFile(filepath.Join(dir, entry.Name()))
		if e != nil {
			return e
		}
		var r row
		if json.Unmarshal(b, &r) == nil && filepath.Base(r.Filename) == r.Filename && strings.HasSuffix(r.Filename, ".webm") {
			r.URL = url.PathEscape(r.Filename)
			rows = append(rows, r)
		}
	}
	var out bytes.Buffer
	t, e := template.New("videos").Parse(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>سجل الفيديو</title><style>body{font:18px sans-serif;margin:30px}video{max-width:90%;width:640px}article{border-bottom:1px solid #ccc;padding:20px}</style><h1>سجل الفيديو</h1>{{range .}}<article><h2>{{.Teacher}}</h2><p>الحصة {{.Period}} — بعد الدورة {{.Cycle}}</p><video controls preload="none" src="{{.URL}}"></video></article>{{else}}<p>لا توجد تسجيلات فيديو.</p>{{end}}</html>`)
	if e != nil {
		return e
	}
	if e = t.Execute(&out, rows); e != nil {
		return e
	}
	dest := filepath.Join(dir, "index.html")
	if _, e = os.Lstat(dest); e == nil {
		if e = videoRegular(dest); e != nil {
			return e
		}
	}
	f, e := os.CreateTemp(dir, ".video-index-")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(out.Bytes()); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	return os.Rename(name, dest)
}
