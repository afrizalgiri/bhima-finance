Dim shell, root
Set shell = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Matikan proses lama di port 3000 dan 5000
shell.Run "cmd /c for /f ""tokens=5"" %p in ('netstat -ano ^| findstr "":3000 ""') do taskkill /PID %p /F", 0, True
shell.Run "cmd /c for /f ""tokens=5"" %p in ('netstat -ano ^| findstr "":5000 ""') do taskkill /PID %p /F", 0, True

WScript.Sleep 1500

' Sinkronisasi database + seed admin user
shell.Run "cmd /c cd /d """ & root & "\app\backend"" && npx prisma db push --skip-generate > nul 2>&1 && node prisma/seed.js > nul 2>&1", 0, True

' Jalankan Backend
shell.Run "cmd /k ""cd /d """ & root & "\app\backend"" && npm run dev""", 1, False

WScript.Sleep 4000

' Jalankan Frontend
shell.Run "cmd /k ""cd /d """ & root & "\app\frontend"" && npm run dev""", 1, False

' Tunggu frontend siap
WScript.Sleep 22000

' Buka browser
shell.Run "http://localhost:3000"
