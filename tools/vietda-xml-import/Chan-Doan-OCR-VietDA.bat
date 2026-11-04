@echo off
rem Chan doan OCR VietDA: chup + OCR thanh menu VietDA, gom vao 1 file zip tren Desktop de gui lai
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0chan-doan-ocr.ps1" %*
pause
