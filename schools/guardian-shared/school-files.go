package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html/template"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"time"
)

const schoolOrigin = "chrome-extension://ologpgneejnippbdhboiaaijpgkejcck/"

type localRequest struct {
	VideoIDs []string          `json:"videoIds"`
	Video    videoWriteRequest `json:"video"`
	Action   string            `json:"action"`
	School   string            `json:"school"`
	Date     string            `json:"date"`
	Record   json.RawMessage   `json:"record"`
	Image    string            `json:"image"`
	Data     json.RawMessage   `json:"data"`
}
type localResponse struct {
	VideoSupport bool   `json:"videoSupport,omitempty"`
	OK           bool   `json:"ok"`
	Error        string `json:"error,omitempty"`
	Path         string `json:"path,omitempty"`
	Verified     bool   `json:"verified"`
}

func localHash(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }
func localDir(root, school, date string) (string, error) {
	if !regexp.MustCompile(`^[a-f0-9-]{36}$`).MatchString(school) {
		return "", errors.New("invalid school")
	}
	d, e := time.Parse("2006-01-02", date)
	if e != nil || d.Format("2006-01-02") != date {
		return "", errors.New("invalid date")
	}
	return filepath.Join(root, "school-"+school, date), nil
}
func secureDirs(root, target string) error {
	rel, e := filepath.Rel(root, target)
	if e != nil || rel == ".." || filepath.IsAbs(rel) {
		return errors.New("invalid directory")
	}
	current := root
	parts := []string{""}
	if rel != "." {
		for _, p := range splitLocalPath(rel) {
			parts = append(parts, p)
		}
	}
	for _, p := range parts {
		if p != "" {
			current = filepath.Join(current, p)
		}
		st, e := os.Lstat(current)
		if os.IsNotExist(e) {
			if e = os.Mkdir(current, 0700); e != nil {
				return e
			}
			continue
		}
		if e != nil {
			return e
		}
		if !st.IsDir() || st.Mode()&os.ModeSymlink != 0 {
			return errors.New("backup directory redirected")
		}
	}
	return nil
}
func splitLocalPath(s string) []string {
	var out []string
	for s != "." && s != "" {
		d, f := filepath.Split(s)
		if f != "" {
			out = append([]string{f}, out...)
		}
		s = filepath.Clean(d)
	}
	return out
}
func localAtomic(path string, body []byte) error {
	if info, e := os.Lstat(path); e == nil && (!info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0) {
		return errors.New("backup file redirected")
	}
	f, e := os.CreateTemp(filepath.Dir(path), ".mirsad-write-")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(body); e != nil {
		f.Close()
		return e
	}
	if e = f.Sync(); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	if e = os.Rename(name, path); e != nil {
		return e
	}
	saved, e := os.ReadFile(path)
	if e != nil || !bytes.Equal(body, saved) {
		return errors.New("local readback failed")
	}
	return nil
}

type localRow struct{ Teacher, Status, Image, Time string }

func localIndex(dir string) error {
	entries, e := os.ReadDir(dir)
	if e != nil {
		return e
	}
	rows := []localRow{}
	for _, entry := range entries {
		if !regexp.MustCompile(`^record-[a-f0-9]{64}\.json$`).MatchString(entry.Name()) {
			continue
		}
		b, e := os.ReadFile(filepath.Join(dir, entry.Name()))
		if e != nil {
			return e
		}
		var v map[string]interface{}
		if json.Unmarshal(b, &v) != nil {
			return errors.New("invalid local record")
		}
		str := func(k string) string { s, _ := v[k].(string); return s }
		status := str("status")
		switch status {
		case "present":
			status = "حاضر"
		case "absent":
			status = "غائب"
		case "unresolved":
			status = "غير محسوم"
		case "no-link":
			status = "لا يوجد رابط"
		}
		teacher := str("teacher")
		if teacher == "" {
			teacher = str("teacherName")
		}
		image := "image-" + localHash([]byte(str("scanId"))) + ".png"
		if _, e := os.Stat(filepath.Join(dir, image)); e != nil {
			image = ""
		}
		rows = append(rows, localRow{Teacher: teacher, Status: status, Image: image})
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i].Teacher < rows[j].Teacher })
	var out bytes.Buffer
	t := template.Must(template.New("archive").Parse(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>نسخة مرصاد المحلية</title><style>body{font:17px Tahoma;margin:30px;color:#173b4a}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #ccc}a{color:#087f73}</style><h1>نسخة مرصاد المحلية — {{.Date}}</h1><p>سجل الفحوص المحلية، وليس بديلًا عن التصنيف النهائي في تقرير الموقع. ملفات JSON تحتفظ بالبيانات الأصلية.</p><table><tr><th>المعلم</th><th>نتيجة الفحص</th><th>الصورة</th></tr>{{range .Rows}}<tr><td>{{.Teacher}}</td><td>{{.Status}}</td><td>{{if .Image}}<a href="{{.Image}}">فتح الصورة</a>{{else}}—{{end}}</td></tr>{{end}}</table></html>`))
	if e = t.Execute(&out, struct {
		Date string
		Rows []localRow
	}{filepath.Base(dir), rows}); e != nil {
		return e
	}
	return localAtomic(filepath.Join(dir, "index.html"), out.Bytes())
}
func handleLocal(root, origin string, r localRequest, open func(string) error) localResponse {
	if origin != schoolOrigin {
		return localResponse{Error: "origin denied"}
	}
	if e := secureDirs(root, root); e != nil {
		return localResponse{Error: e.Error()}
	}
	if r.Action == "probe" {
		probe := filepath.Join(root, ".write-check-"+localHash([]byte(time.Now().String())))
		if e := localAtomic(probe, []byte("Mirsad local write/read check")); e != nil {
			return localResponse{Error: e.Error()}
		}
		_ = os.Remove(probe)
		return localResponse{OK: true, Path: root, Verified: true, VideoSupport: true}
	}
	if r.Action == "open" {
		p := root
		if r.School != "" && r.Date == "" {
			if !regexp.MustCompile(`^[a-f0-9-]{36}$`).MatchString(r.School) {
				return localResponse{Error: "invalid school"}
			}
			p = filepath.Join(root, "school-"+r.School)
			if e := secureDirs(root, p); e != nil {
				return localResponse{Error: e.Error()}
			}
		}
		if r.Date != "" {
			var e error
			p, e = localDir(root, r.School, r.Date)
			if e != nil {
				return localResponse{Error: e.Error()}
			}
		}
		if e := open(p); e != nil {
			return localResponse{Error: e.Error()}
		}
		return localResponse{OK: true, Path: p}
	}
	if r.Action == "videoReset" || r.Action == "videoDelete" {
		if _, e := localDir(root, r.School, r.Date); e != nil {
			return localResponse{Error: e.Error()}
		}
		var e error
		if r.Action == "videoDelete" {
			e = videoDelete(filepath.Join(root, "school-"+r.School), r.Date, r.VideoIDs)
		} else {
			e = videoReset(filepath.Join(root, "school-"+r.School), r.Date)
		}
		if e != nil {
			return localResponse{Error: e.Error()}
		}
		return localResponse{OK: true, Verified: true, VideoSupport: true}
	}
	if r.Action == "videoWrite" {
		if _, e := localDir(root, r.School, r.Video.Date); e != nil {
			return localResponse{Error: e.Error()}
		}
		p, e := videoWrite(filepath.Join(root, "school-"+r.School), r.Video)
		if e != nil {
			return localResponse{Error: e.Error()}
		}
		return localResponse{OK: true, Path: p, Verified: p != "", VideoSupport: true}
	}
	dir, e := localDir(root, r.School, r.Date)
	if e != nil {
		return localResponse{Error: e.Error()}
	}
	if e = secureDirs(root, dir); e != nil {
		return localResponse{Error: e.Error()}
	}
	if r.Action == "snapshot" {
		var v map[string]json.RawMessage
		if json.Unmarshal(r.Data, &v) != nil {
			return localResponse{Error: "invalid snapshot"}
		}
		clean := map[string]json.RawMessage{}
		for _, k := range []string{"snapshot", "records", "adjustments", "reportSchedule", "letterhead"} {
			if value, ok := v[k]; ok {
				clean[k] = value
			}
		}
		var snapshot struct {
			Date string `json:"date"`
		}
		if json.Unmarshal(clean["snapshot"], &snapshot) != nil || snapshot.Date != r.Date {
			return localResponse{Error: "snapshot date mismatch"}
		}
		b, _ := json.Marshal(clean)
		e = localAtomic(filepath.Join(dir, "day.json"), b)
	} else if r.Action == "save" {
		var record struct {
			ScanID string `json:"scanId"`
			Status string `json:"status"`
		}
		if json.Unmarshal(r.Record, &record) != nil || record.ScanID == "" || len(record.ScanID) > 512 {
			return localResponse{Error: "invalid record"}
		}
		if record.Status != "present" && record.Status != "absent" && record.Status != "unresolved" && record.Status != "no-link" {
			return localResponse{Error: "invalid status"}
		}
		id := localHash([]byte(record.ScanID))
		if r.Image != "" {
			const prefix = "data:image/png;base64,"
			if len(r.Image) < len(prefix) || r.Image[:len(prefix)] != prefix || (record.Status != "absent" && record.Status != "unresolved") {
				return localResponse{Error: "invalid image"}
			}
			b, err := base64.StdEncoding.DecodeString(r.Image[len(prefix):])
			if err != nil || len(b) > 12*1024*1024 || !bytes.HasPrefix(b, []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
				return localResponse{Error: "invalid PNG"}
			}
			if e = localAtomic(filepath.Join(dir, "image-"+id+".png"), b); e != nil {
				return localResponse{Error: e.Error()}
			}
		}
		e = localAtomic(filepath.Join(dir, "record-"+id+".json"), r.Record)
	} else {
		return localResponse{Error: "unsupported action"}
	}
	if e == nil {
		e = localIndex(dir)
	}
	if e != nil {
		return localResponse{Error: e.Error()}
	}
	return localResponse{OK: true, Path: dir, Verified: true}
}
func serveLocal(input io.Reader, output io.Writer, root, origin string, open func(string) error) error {
	var size uint32
	if e := binary.Read(input, binary.LittleEndian, &size); e != nil {
		return e
	}
	if size == 0 || size > 24*1024*1024 {
		return errors.New("invalid message size")
	}
	body := make([]byte, size)
	if _, e := io.ReadFull(input, body); e != nil {
		return e
	}
	var r localRequest
	result := localResponse{Error: "invalid JSON"}
	if json.Unmarshal(body, &r) == nil {
		result = handleLocal(root, origin, r, open)
	}
	b, e := json.Marshal(result)
	if e != nil {
		return e
	}
	if e = binary.Write(output, binary.LittleEndian, uint32(len(b))); e != nil {
		return e
	}
	_, e = output.Write(b)
	return e
}
