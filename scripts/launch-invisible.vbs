Set WshShell = CreateObject("WScript.Shell")
' Launch bun with window style 0 (hidden)
WshShell.Run "bun scripts/customer-server.ts", 0, False
