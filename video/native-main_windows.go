package main
import "os"
func main(){if len(os.Args)>1&&os.Args[1]=="--install-native"{if installSchoolNative()!=nil{os.Exit(1)};return};if len(os.Args)<2{os.Exit(1)};runSchoolNative(os.Args[1])}
