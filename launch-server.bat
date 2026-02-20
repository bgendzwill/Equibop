@echo off
cd /d "d:\Skrypty\Equibop"
:: Call the VBScript wrapper which starts the server without a window
wscript //nologo scripts\launch-invisible.vbs
:: The cmd window will now exit immediately while the server stays running in the background
exit
