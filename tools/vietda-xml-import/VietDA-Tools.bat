@echo off
rem Double-click: cua so chay 2 tool VietDA (Kiem / sua phieu XH + Sao ke -> phieu thu/chi). Log cua cua so: _vietda-ui.log
start "" powershell -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0vietda-tools-ui.ps1"
