@echo off
rem Double-click: doc sao ke TPBank + CSV doi soat CK trong thu muc Input, chon thu muc XML dau vao -> xem danh sach -> go Y -> ket qua o thu muc Output
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vietda-bank-import.ps1" %*
pause
