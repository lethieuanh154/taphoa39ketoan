@echo off
rem Double-click: kiem phieu XH tren VietDA nhu Kiem-PhieuXH-VietDA.bat, roi SUA + LUU dau phieu sai (Ly do, Ky hieu, So HD,
rem Phuong thuc TT, Ghi no, Ghi co theo XML). Tool hoi Y truoc khi sua. Dong hang KHONG sua. Khong bam vao VietDA khi tool dang chay.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vietda-sales-check.ps1" -Fix %*
pause
