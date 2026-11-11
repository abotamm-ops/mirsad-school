from pathlib import Path
import os,shutil,subprocess
repo=Path(__file__).resolve().parents[1]
go=os.environ.get('MIRSAD_GO','/tmp/mirsad-go-toolchain/go/bin/go')
assert (repo/'local-backup-host/video.go').read_bytes()==(repo/'schools/guardian-shared/video.go').read_bytes(),'Video disk sources must match'
out=Path('/tmp/mirsad-video-native-output');out.mkdir(exist_ok=True)
env={**os.environ,'GOCACHE':'/tmp/mirsad-go-cache','GOPROXY':'off','GOOS':'windows'}
for arch in ['amd64','386']:
 subprocess.run([go,'build','-buildvcs=false','-trimpath','-ldflags=-H windowsgui -s -w','-o',str(out/f'MirsadBackupHost-{arch}.exe'),'.'],cwd=repo/'local-backup-host',env={**env,'GOARCH':arch},check=True)
work=Path('/tmp/mirsad-video-native-schools');work.mkdir(exist_ok=True)
for name in ['school-files.go','school-files_windows.go','video.go']:shutil.copy2(repo/'schools/guardian-shared'/name,work/name)
shutil.copy2(repo/'video/native-main_windows.go',work/'main_windows.go')
(work/'go.mod').write_text('module mirsad.local/video-files\n\ngo 1.23\n')
subprocess.run([go,'build','-buildvcs=false','-trimpath','-ldflags=-H windowsgui -s -w','-o',str(out/'MirsadSchoolFilesHost.exe'),'.'],cwd=work,env={**env,'GOARCH':'amd64'},check=True)
print('Built existing disk-backup component for private and schools; guardian unchanged.')
