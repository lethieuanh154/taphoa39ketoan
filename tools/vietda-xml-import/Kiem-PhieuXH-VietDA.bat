@echo off
rem Double-click: kiem phieu XH tren VietDA (sau Hoi nhap XML) so voi XML ban ra trong xml\sold + danh muc Vat tu hang hoa trong Input -> ket qua o thu muc Output
rem Tool CHI DOC (mo tung phieu trong Tim kiem chung tu, doc roi Thoat), KHONG sua phieu. Khong bam vao VietDA khi tool dang chay.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0vietda-sales-check.ps1" %*
pause
