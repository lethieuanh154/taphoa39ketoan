@echo off
rem Double-click: chon sao ke TPBank + CSV doi soat CK + thu muc XML dau vao -> xem danh sach -> go Y de tao phieu thu/chi tien gui tren VietDA
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vietda-bank-import.ps1" %*
pause
