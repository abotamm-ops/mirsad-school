package main
import("os";"strings";"fmt";"syscall";"unsafe")
func showError(message string){title,_:=syscall.UTF16PtrFromString("حفظ ملفات مرصاد");body,_:=syscall.UTF16PtrFromString(message);syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0,uintptr(unsafe.Pointer(body)),uintptr(unsafe.Pointer(title)),0x50010)}
func main(){if len(os.Args)>1&&strings.HasPrefix(os.Args[1],"chrome-extension://"){runSchoolNative(os.Args[1]);return};if len(os.Args)==2&&os.Args[1]=="--install"{if e:=installSchoolNative();e!=nil{showError(fmt.Sprint("تعذر تجهيز النسخة المحلية؛ الطلبات في الإضافة باقية للمحاولة.\n",e));os.Exit(1)};return};showError("ملف دعم للحفظ المحلي؛ شغّل مرصاد من ملف بدء مرصاد داخل الحزمة.")}
