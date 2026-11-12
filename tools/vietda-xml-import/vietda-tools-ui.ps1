<#
.SYNOPSIS
  Cửa sổ chạy 2 tool VietDA theo từng bước (10/11/2026) — WinForms trong PowerShell, không cần cài thêm.
    Tab "Kiểm / sửa phiếu XH" (vietda-sales-check.ps1):
      1 XML bán ra (thêm file vào xml\sold hoặc chọn thư mục khác) · 2 Danh mục Vật tư hàng hóa (Input\danh-muc-vthh) · 3 VietDA ·
      4 Kiểm tra → ĐẠT thì nút Sửa xám · 5 Sửa + Lưu (chỉ bật khi KHÔNG ĐẠT + còn đầu phiếu tool sửa được).
    Tab "Sao kê → phiếu thu/chi" (vietda-bank-import.ps1):
      1 Sao kê TPBank · 2 Excel Đối soát CK · 3 Danh mục Đối tượng (cả 3 copy vào Input\) · 4 XML · 5 VietDA + loại phiếu · 6 Chạy.
  Script chạy ở tiến trình powershell riêng (đọc stdout hiện log); 2 script và .bat cũ giữ nguyên.
  "Bỏ file" = chuyển vào _cu\<ngày-giờ>\ (không xóa). Lựa chọn thư mục nhớ ở _vietda-ui.json. Log cửa sổ: _vietda-ui.log.
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$ToolDir = $PSScriptRoot
$InputDir = Join-Path $ToolDir 'Input'
$CatalogDir = Join-Path $InputDir 'danh-muc-vthh'
$XmlRoot = Join-Path $ToolDir 'xml'
$OutRoot = Join-Path $ToolDir 'Output'
$UiLog = Join-Path $ToolDir '_vietda-ui.log'
$SettingsFile = Join-Path $ToolDir '_vietda-ui.json'
$XhScript = Join-Path $ToolDir 'vietda-sales-check.ps1'
$BankScript = Join-Path $ToolDir 'vietda-bank-import.ps1'
function Write-UiLog([string]$Message) {
    try { Add-Content -LiteralPath $UiLog -Value ('{0:yyyy-MM-dd HH:mm:ss} {1}' -f (Get-Date), $Message) -Encoding UTF8 } catch { }
}

# Chạy script ở tiến trình riêng, gom từng dòng stdout/stderr vào hàng đợi (luồng nền .NET — handler PowerShell không chạy được
# ngoài luồng UI) → Timer của cửa sổ lấy ra hiện log.
if (-not ('VdUiRunner' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
public class VdUiRunner {
    Process p;
    public ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
    public void Start(string args, string cwd) {
        ProcessStartInfo si = new ProcessStartInfo("powershell.exe", args);
        si.UseShellExecute = false; si.CreateNoWindow = true; si.WorkingDirectory = cwd;
        si.RedirectStandardOutput = true; si.RedirectStandardError = true;
        si.StandardOutputEncoding = Encoding.UTF8; si.StandardErrorEncoding = Encoding.UTF8;
        p = new Process(); p.StartInfo = si;
        p.OutputDataReceived += (s, e) => { if (e.Data != null) Lines.Enqueue(e.Data); };
        p.ErrorDataReceived += (s, e) => { if (e.Data != null) Lines.Enqueue("[STDERR] " + e.Data); };
        p.Start(); p.BeginOutputReadLine(); p.BeginErrorReadLine();
    }
    public bool Running { get { return p != null && !p.HasExited; } }
    public int Finish() { p.WaitForExit(); return p.ExitCode; }
    public void Kill() {
        if (!Running) return;
        try { Process.Start(new ProcessStartInfo("taskkill", "/T /F /PID " + p.Id) { CreateNoWindow = true, UseShellExecute = false }).WaitForExit(5000); } catch { }
    }
}
"@
}

# ---------------- cài đặt nhớ giữa các lần mở ----------------
$script:cfg = @{ XhXmlFolder = ''; BankXmlFolder = '' }
try { if (Test-Path -LiteralPath $SettingsFile) { $j = ConvertFrom-Json ([IO.File]::ReadAllText($SettingsFile, [Text.Encoding]::UTF8)); foreach ($k in @('XhXmlFolder', 'BankXmlFolder')) { if ($j.$k) { $script:cfg[$k] = [string]$j.$k } } } } catch { Write-UiLog "Đọc $SettingsFile lỗi: $($_.Exception.Message)" }
function Save-Settings { try { [IO.File]::WriteAllText($SettingsFile, (ConvertTo-Json $script:cfg), (New-Object Text.UTF8Encoding $false)) } catch { Write-UiLog "Ghi $SettingsFile lỗi: $($_.Exception.Message)" } }

# ---------------- trạng thái ----------------
$script:runner = $null
$script:job = $null
$script:lastOut = $null
$script:xhChecked = $null
$script:readCount = 0

# ---------------- dựng giao diện ----------------
$font = New-Object System.Drawing.Font('Segoe UI', 9.5)
$bold = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$green = [System.Drawing.Color]::ForestGreen; $red = [System.Drawing.Color]::Firebrick; $gray = [System.Drawing.Color]::DimGray; $orange = [System.Drawing.Color]::DarkOrange
$form = New-Object System.Windows.Forms.Form
$form.Text = 'VietDA Tools — Song Minh'
$form.Size = New-Object System.Drawing.Size(1100, 920)
$form.MinimumSize = New-Object System.Drawing.Size(980, 700)
$form.StartPosition = 'CenterScreen'
$form.Font = $font
$tip = New-Object System.Windows.Forms.ToolTip

function New-Label([string]$Text, [int]$X, [int]$Y, [int]$W = 600, [int]$H = 22) {
    $l = New-Object System.Windows.Forms.Label; $l.Text = $Text; $l.Location = New-Object System.Drawing.Point($X, $Y); $l.Size = New-Object System.Drawing.Size($W, $H); $l
}
function New-Button([string]$Text, [int]$X, [int]$Y, [int]$W = 150) {
    $b = New-Object System.Windows.Forms.Button; $b.Text = $Text; $b.Location = New-Object System.Drawing.Point($X, $Y); $b.Size = New-Object System.Drawing.Size($W, 30); $b
}
function New-List([int]$X, [int]$Y, [int]$W, [int]$H) {
    $l = New-Object System.Windows.Forms.ListBox; $l.Location = New-Object System.Drawing.Point($X, $Y); $l.Size = New-Object System.Drawing.Size($W, $H); $l.SelectionMode = 'MultiExtended'; $l.HorizontalScrollbar = $true; $l
}
# 1 bước = GroupBox "Bước N — tiêu đề" + nhãn trạng thái ✔/✘ góc phải
function New-Step($Parent, [int]$N, [string]$Title, [int]$Y, [int]$H) {
    $g = New-Object System.Windows.Forms.GroupBox
    $g.Text = "Bước $N — $Title"; $g.Font = $bold
    $g.Location = New-Object System.Drawing.Point(10, $Y); $g.Size = New-Object System.Drawing.Size(1030, $H)
    $st = New-Label '' 770 0 250 22; $st.TextAlign = 'MiddleRight'; $st.Font = $bold
    $g.Controls.Add($st)
    $Parent.Controls.Add($g)
    [pscustomobject]@{ Box = $g; Status = $st }
}
# control trong GroupBox dùng font thường
function Add-To($Step, $Controls) { foreach ($c in $Controls) { $c.Font = $font; $Step.Box.Controls.Add($c) } }
function Set-StepStatus($Step, [string]$State, [string]$Text) {
    $Step.Status.Text = switch ($State) { 'ok' { "✔ $Text" } 'bad' { "✘ $Text" } 'warn' { "⚠ $Text" } default { "○ $Text" } }
    $Step.Status.ForeColor = switch ($State) { 'ok' { $green } 'bad' { $red } 'warn' { $orange } default { $gray } }
}

$split = New-Object System.Windows.Forms.SplitContainer; $split.Dock = 'Fill'; $split.Orientation = 'Horizontal'
$tabs = New-Object System.Windows.Forms.TabControl; $tabs.Dock = 'Fill'
$split.Panel1.Controls.Add($tabs)

# ===================== Tab 1: Kiểm / sửa phiếu XH =====================
$tabXh = New-Object System.Windows.Forms.TabPage; $tabXh.Text = 'Kiểm / sửa phiếu XH (sau Hội nhập XML)'; $tabXh.AutoScroll = $true
$x1 = New-Step $tabXh 1 'XML hóa đơn bán ra (XML QUY ĐỔI, đúng bản đã Hội nhập)' 8 112
$rbXhTool = New-Object System.Windows.Forms.RadioButton; $rbXhTool.Location = New-Object System.Drawing.Point(14, 26); $rbXhTool.Size = New-Object System.Drawing.Size(560, 24)
$rbXhOther = New-Object System.Windows.Forms.RadioButton; $rbXhOther.Text = 'Thư mục khác:'; $rbXhOther.Location = New-Object System.Drawing.Point(14, 52); $rbXhOther.Size = New-Object System.Drawing.Size(120, 24)
$txtXhFolder = New-Object System.Windows.Forms.TextBox; $txtXhFolder.ReadOnly = $true; $txtXhFolder.Location = New-Object System.Drawing.Point(136, 52); $txtXhFolder.Size = New-Object System.Drawing.Size(560, 24)
$btnXhPick = New-Button 'Chọn thư mục…' 704 50 130
$btnXhAddXml = New-Button 'Thêm file XML…' 14 80 140
$btnXhOpenXml = New-Button 'Mở thư mục' 162 80 110
$btnXhClearXml = New-Button 'Dọn XML cũ…' 280 80 120
$lblXhXmlHint = New-Label 'Tool đọc MỌI XML trong thư mục (cả thư mục con) — dọn XML kỳ trước để khỏi lẫn.' 410 85 600
$lblXhXmlHint.ForeColor = $gray
Add-To $x1 @($rbXhTool, $rbXhOther, $txtXhFolder, $btnXhPick, $btnXhAddXml, $btnXhOpenXml, $btnXhClearXml, $lblXhXmlHint)

$x2 = New-Step $tabXh 2 'Danh mục Vật tư hàng hóa (tùy chọn)' 126 104
$lblXhCat = New-Label '' 14 26 800
$btnXhCatPick = New-Button 'Chọn file danh mục…' 14 50 160
$btnXhCatOpen = New-Button 'Mở thư mục' 182 50 110
$btnXhCatRemove = New-Button 'Bỏ danh mục' 300 50 110
$lblXhCatHint = New-Label 'Xuất từ VietDA: Hệ thống > Cập nhật danh mục > Vật tư, hàng hóa > Excel. Tool copy vào Input\danh-muc-vthh (không để thẳng trong Input — tool sao kê sẽ coi là sao kê). Không có thì không kiểm mã theo danh mục.' 14 82 1000 20; $lblXhCatHint.ForeColor = $gray
Add-To $x2 @($lblXhCat, $btnXhCatPick, $btnXhCatOpen, $btnXhCatRemove, $lblXhCatHint)

$x3 = New-Step $tabXh 3 'VietDA' 236 78
$lblXhVda = New-Label '' 14 24 1000 44
$lblXhVda.Text = 'Mở VietDA, đăng nhập đúng file dữ liệu. Nên mở sẵn Nhập xuất > Tìm kiếm chứng từ (loại XH, khoảng ngày) — tool dùng luôn danh sách đó; không có thì tool tự mở theo khoảng ngày. Trong lúc chạy KHÔNG bấm vào VietDA (dùng app khác được).'
Add-To $x3 @($lblXhVda)

$x4 = New-Step $tabXh 4 'Kiểm tra' 320 112
$chkXhAuto = New-Object System.Windows.Forms.CheckBox; $chkXhAuto.Text = 'Khoảng ngày theo XML'; $chkXhAuto.Checked = $true
$chkXhAuto.Location = New-Object System.Drawing.Point(14, 28); $chkXhAuto.Size = New-Object System.Drawing.Size(180, 24)
$dtXhFrom = New-Object System.Windows.Forms.DateTimePicker; $dtXhFrom.Format = 'Custom'; $dtXhFrom.CustomFormat = 'dd/MM/yyyy'
$dtXhFrom.Location = New-Object System.Drawing.Point(200, 27); $dtXhFrom.Width = 120; $dtXhFrom.Enabled = $false
$lblXhArrow = New-Label '→' 326 30 20
$dtXhTo = New-Object System.Windows.Forms.DateTimePicker; $dtXhTo.Format = 'Custom'; $dtXhTo.CustomFormat = 'dd/MM/yyyy'
$dtXhTo.Location = New-Object System.Drawing.Point(348, 27); $dtXhTo.Width = 120; $dtXhTo.Enabled = $false
$lblXhLimit = New-Label 'Chỉ chạy N phiếu đầu (0 = tất cả):' 500 30 220
$numXhLimit = New-Object System.Windows.Forms.NumericUpDown; $numXhLimit.Location = New-Object System.Drawing.Point(722, 27); $numXhLimit.Width = 70; $numXhLimit.Maximum = 100000
$btnXhCheck = New-Button 'Kiểm tra' 14 62 150
$btnXhReport = New-Button 'Kết quả kiểm tra' 172 62 150
$lblXhResult = New-Label 'Chưa kiểm tra.' 334 60 680 46; $lblXhResult.Font = $bold
Add-To $x4 @($chkXhAuto, $dtXhFrom, $lblXhArrow, $dtXhTo, $lblXhLimit, $numXhLimit, $btnXhCheck, $btnXhReport)
$x4.Box.Controls.Add($lblXhResult)

$x5 = New-Step $tabXh 5 'Sửa + Lưu đầu phiếu (bật khi Bước 4 KHÔNG ĐẠT)' 438 86
$btnXhFix = New-Button 'Sửa + Lưu đầu phiếu' 14 28 190; $btnXhFix.Enabled = $false
$lblXhFixNote = New-Label "Sửa theo XML: Lý do 'Doanh thu bán hàng', Ký hiệu, Số HĐ, Phương thức TT, Ghi nợ (CK 131 / TM 1111), Ghi có 33311 → Lưu → mở lại kiểm. Dòng hàng (mã, tiền) KHÔNG sửa — sửa tay theo cột 'So với XML'." 214 26 800 52
$lblXhFixNote.ForeColor = $gray
Add-To $x5 @($btnXhFix, $lblXhFixNote)

# ===================== Tab 2: Sao kê → phiếu thu/chi =====================
$tabBank = New-Object System.Windows.Forms.TabPage; $tabBank.Text = 'Sao kê → phiếu thu/chi tiền gửi'; $tabBank.AutoScroll = $true
$b1 = New-Step $tabBank 1 'Sao kê TPBank (.xlsx) — nhiều file được' 8 104
$lstStm = New-List 14 26 700 72
$btnStmAdd = New-Button 'Thêm sao kê…' 724 26 140; $btnStmDel = New-Button 'Bỏ file đã chọn' 724 62 140; $btnStmOpen = New-Button 'Mở Input' 872 26 110
Add-To $b1 @($lstStm, $btnStmAdd, $btnStmDel, $btnStmOpen)

$b2 = New-Step $tabBank 2 'Excel Đối soát CK (cần cho phiếu thu)' 116 92
$lstRecon = New-List 14 26 700 56
$btnReconAdd = New-Button 'Thêm file…' 724 26 140; $btnReconDel = New-Button 'Bỏ file đã chọn' 724 58 140
$lblReconHint = New-Label 'KeToan > Đối soát CK > Xuất Excel (doi-soat-ck_*.xlsx)' 872 26 150 56; $lblReconHint.ForeColor = $gray
Add-To $b2 @($lstRecon, $btnReconAdd, $btnReconDel, $lblReconHint)

$b3 = New-Step $tabBank 3 'Danh mục Đối tượng (DANH SACH.xlsx)' 212 76
$lstObj = New-List 14 26 700 40
$btnObjAdd = New-Button 'Thêm file…' 724 26 140; $btnObjDel = New-Button 'Bỏ file đã chọn' 872 26 140
$tip.SetToolTip($btnObjAdd, 'VietDA: xuất danh mục Đối tượng ra Excel (file có dòng "DANH MỤC ĐỐI TƯỢNG")')
Add-To $b3 @($lstObj, $btnObjAdd, $btnObjDel)

$b4 = New-Step $tabBank 4 'XML hóa đơn' 292 112
$rbBankTool = New-Object System.Windows.Forms.RadioButton; $rbBankTool.Location = New-Object System.Drawing.Point(14, 26); $rbBankTool.Size = New-Object System.Drawing.Size(620, 24)
$rbBankOther = New-Object System.Windows.Forms.RadioButton; $rbBankOther.Text = 'Thư mục khác:'; $rbBankOther.Location = New-Object System.Drawing.Point(14, 52); $rbBankOther.Size = New-Object System.Drawing.Size(120, 24)
$txtBankFolder = New-Object System.Windows.Forms.TextBox; $txtBankFolder.ReadOnly = $true; $txtBankFolder.Location = New-Object System.Drawing.Point(136, 52); $txtBankFolder.Size = New-Object System.Drawing.Size(560, 24)
$btnBankPick = New-Button 'Chọn thư mục…' 704 50 130
$btnBankAddSold = New-Button 'Thêm XML bán ra…' 14 80 150; $btnBankAddPur = New-Button 'Thêm XML mua vào…' 172 80 160; $btnBankOpenXml = New-Button 'Mở thư mục xml' 340 80 130
$lblBankXmlHint = New-Label 'Bán ra → người mua của phiếu thu; mua vào → phiếu chi khi thiếu Excel đối soát.' 480 85 540; $lblBankXmlHint.ForeColor = $gray
Add-To $b4 @($lblBankXmlHint, $rbBankTool, $rbBankOther, $txtBankFolder, $btnBankPick, $btnBankAddSold, $btnBankAddPur, $btnBankOpenXml)

$b5 = New-Step $tabBank 5 'VietDA — mở Thu chi > Phiếu thu / chi tiền gửi' 408 66
$lblBankMode = New-Label 'Loại phiếu:' 14 32 80
$cmbBankMode = New-Object System.Windows.Forms.ComboBox; $cmbBankMode.DropDownStyle = 'DropDownList'
$cmbBankMode.Location = New-Object System.Drawing.Point(96, 29); $cmbBankMode.Width = 280
[void]$cmbBankMode.Items.AddRange(@('Theo tab đang mở trên VietDA', 'Phiếu thu (Ghi có)', 'Phiếu chi (Ghi nợ)')); $cmbBankMode.SelectedIndex = 0
$lblBankLimit = New-Label 'Chỉ làm N phiếu đầu (0 = tất cả):' 400 32 220
$numBankLimit = New-Object System.Windows.Forms.NumericUpDown; $numBankLimit.Location = New-Object System.Drawing.Point(622, 29); $numBankLimit.Width = 70; $numBankLimit.Maximum = 100000
Add-To $b5 @($lblBankMode, $cmbBankMode, $lblBankLimit, $numBankLimit)

$b6 = New-Step $tabBank 6 'Chạy' 478 108
$btnBankDry = New-Button 'Xem trước (không tạo)' 14 28 180
$btnBankVerify = New-Button 'Chỉ kiểm tra VietDA' 202 28 170
$btnBankCreate = New-Button 'Tạo phiếu' 380 28 130
$btnBankReport = New-Button 'Kết quả chạy' 518 28 130
$lblBankNote = New-Label 'Tool sao kê dùng CHUỘT + BÀN PHÍM thật trên VietDA — cửa sổ này tự thu nhỏ khi chạy: KHÔNG đụng máy tới khi xong.' 680 22 340 60; $lblBankNote.ForeColor = $red
$lblBankResult = New-Label '' 14 64 1000 36; $lblBankResult.Font = $bold
Add-To $b6 @($btnBankDry, $btnBankVerify, $btnBankCreate, $btnBankReport, $lblBankNote)
$b6.Box.Controls.Add($lblBankResult)
$tabs.TabPages.AddRange(@($tabXh, $tabBank))

# ===== phần dưới: tiến độ + log =====
$bar = New-Object System.Windows.Forms.Panel; $bar.Dock = 'Top'; $bar.Height = 42
$lblStatus = New-Label 'Sẵn sàng.' 12 11 640
$progress = New-Object System.Windows.Forms.ProgressBar; $progress.Location = New-Object System.Drawing.Point(660, 11); $progress.Size = New-Object System.Drawing.Size(150, 20)
$btnStop = New-Button 'Dừng' 820 5 80; $btnStop.Enabled = $false
$btnOutDir = New-Button 'Thư mục kết quả' 908 5 150
$bar.Width = $form.ClientSize.Width
foreach ($c in @($progress, $btnStop, $btnOutDir)) { $c.Anchor = 'Top, Right' }
$bar.Controls.AddRange(@($lblStatus, $progress, $btnStop, $btnOutDir))
$log = New-Object System.Windows.Forms.RichTextBox; $log.Dock = 'Fill'; $log.ReadOnly = $true; $log.BackColor = [System.Drawing.Color]::White
$log.Font = New-Object System.Drawing.Font('Consolas', 9.5); $log.WordWrap = $false
$split.Panel2.Controls.Add($log); $split.Panel2.Controls.Add($bar)
$form.Controls.Add($split)
$form.Add_Shown({ $split.SplitterDistance = [Math]::Max(300, $form.ClientSize.Height - 210) })

function Add-Log([string]$Line) {
    $color = switch -Regex ($Line) {
        '\[ERROR\]|\[STDERR\]' { $red; break }
        '\[WARN\]' { $orange; break }
        '\[OK\]' { $green; break }
        '^>>' { [System.Drawing.Color]::RoyalBlue; break }
        default { [System.Drawing.Color]::Black }
    }
    $log.SelectionStart = $log.TextLength; $log.SelectionLength = 0; $log.SelectionColor = $color
    $log.AppendText($Line + "`r`n")
    $log.ScrollToCaret()
}

# ---------------- file / thư mục ----------------
function Get-Files([string]$Dir, [string[]]$Ext, [switch]$Recurse) {
    if (-not (Test-Path -LiteralPath $Dir)) { return @() }
    @(Get-ChildItem -LiteralPath $Dir -File -Recurse:$Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '~$*' -and $Ext -contains $_.Extension.ToLowerInvariant() -and $_.FullName -notmatch '\\_cu\\' })
}
function Show-Error([string]$Text) { [System.Windows.Forms.MessageBox]::Show($form, $Text, 'VietDA Tools', 'OK', 'Error') | Out-Null }
# copy file vào thư mục tool; trùng tên → hỏi ghi đè 1 lần; $Prefix: đổi tên để tool / cửa sổ nhận đúng loại file
function Import-Files([string[]]$Files, [string]$Dest, [string]$Prefix = '', [string]$Match = '') {
    if (-not $Files.Count) { return 0 }
    if (-not (Test-Path -LiteralPath $Dest)) { New-Item -ItemType Directory -Path $Dest -Force | Out-Null }
    $plan = foreach ($f in $Files) {
        $name = [IO.Path]::GetFileName($f)
        if ($Prefix -and $Match -and $name -notmatch $Match) { $name = $Prefix + $name }
        [pscustomobject]@{ Src = $f; Dst = (Join-Path $Dest $name) }
    }
    $same = @($plan | Where-Object { (Test-Path -LiteralPath $_.Dst) -and ([IO.Path]::GetFullPath($_.Src) -ne [IO.Path]::GetFullPath($_.Dst)) })
    if ($same.Count -and [System.Windows.Forms.MessageBox]::Show($form, "Đã có $($same.Count) file cùng tên trong $Dest`r`n($((@($same | Select-Object -First 5 | ForEach-Object { [IO.Path]::GetFileName($_.Dst) })) -join ', ')).`r`nGhi đè?", 'Thêm file', 'YesNo', 'Question') -ne 'Yes') { $plan = @($plan | Where-Object { $same -notcontains $_ }) }
    $n = 0
    foreach ($p in $plan) {
        if ([IO.Path]::GetFullPath($p.Src) -eq [IO.Path]::GetFullPath($p.Dst)) { continue }
        try { Copy-Item -LiteralPath $p.Src -Destination $p.Dst -Force; $n++ } catch { Show-Error "Không copy được $($p.Src)`r`n$($_.Exception.Message)" }
    }
    Add-Log ">> Đã thêm $n file vào $Dest"; Write-UiLog "Thêm $n file vào $Dest"
    return $n
}
# "Bỏ file" = chuyển vào <thư mục>\_cu\<ngày-giờ>\ (không xóa — lấy lại được)
function Move-ToOld([string[]]$Files, [string]$BaseDir) {
    if (-not $Files.Count) { return }
    $dest = Join-Path (Join-Path $BaseDir '_cu') (Get-Date -Format 'yyyyMMdd_HHmmss')
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    foreach ($f in $Files) { try { Move-Item -LiteralPath $f -Destination $dest -Force } catch { Show-Error "Không chuyển được $f`r`n$($_.Exception.Message)" } }
    Add-Log ">> Đã chuyển $($Files.Count) file vào $dest"; Write-UiLog "Bỏ $($Files.Count) file → $dest"
}
function Pick-Files([string]$Title, [string]$Filter, [bool]$Multi = $true) {
    $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = $Title; $d.Filter = $Filter; $d.Multiselect = $Multi
    $dl = Join-Path $env:USERPROFILE 'Downloads'; if (Test-Path $dl) { $d.InitialDirectory = $dl }
    if ($d.ShowDialog($form) -eq 'OK') { return , @($d.FileNames) } else { return , @() }
}
function Pick-Folder([string]$Title, [string]$Start) {
    $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = $Title; $d.ShowNewFolderButton = $false
    if ($Start -and (Test-Path -LiteralPath $Start)) { $d.SelectedPath = $Start } else { $d.SelectedPath = Join-Path $env:USERPROFILE 'Downloads' }
    if ($d.ShowDialog($form) -eq 'OK') { return $d.SelectedPath } else { return $null }
}
$openDir = { param($d) if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }; Start-Process explorer.exe $d }
function Test-Converted([string]$Path) { try { $fs = [IO.File]::OpenRead($Path); try { $buf = New-Object byte[] 600; $n = $fs.Read($buf, 0, 600); [Text.Encoding]::UTF8.GetString($buf, 0, $n).Contains('Bản QUY ĐỔI ĐVT') } finally { $fs.Dispose() } } catch { $false } }
function Fill-List($List, $Files) { $List.BeginUpdate(); $List.Items.Clear(); foreach ($f in $Files) { [void]$List.Items.Add("$($f.Name)   ($($f.LastWriteTime.ToString('dd/MM/yyyy HH:mm')))") }; $List.EndUpdate(); $List.Tag = @($Files | ForEach-Object { $_.FullName }) }
function Get-Selected($List) { $all = @($List.Tag); @($List.SelectedIndices | ForEach-Object { $all[$_] }) }

# phân loại file trong Input\ (giống cách tool sao kê nhận: đối soát / danh mục đối tượng / còn lại = sao kê)
function Get-InputGroups {
    $files = @(Get-Files $InputDir @('.xlsx', '.csv'))
    $recon = @($files | Where-Object { $_.Name -match '(?i)^doi-soat-ck' -or $_.Extension -eq '.csv' })
    $obj = @($files | Where-Object { $_.Name -match '(?i)^DANH[ _-]?SACH|doi.?tuong' -and $recon -notcontains $_ })
    $cat = @($files | Where-Object { $_.Name -match '(?i)vat.?tu|hang.?hoa|vthh' -and $recon -notcontains $_ -and $obj -notcontains $_ })
    $stm = @($files | Where-Object { $_.Extension -eq '.xlsx' -and $recon -notcontains $_ -and $obj -notcontains $_ -and $cat -notcontains $_ })
    [pscustomobject]@{ Statements = $stm; Recon = $recon; Objects = $obj; StrayCatalog = $cat }
}

# ---------------- cập nhật trạng thái các bước ----------------
function Update-XhSteps {
    $toolSold = Join-Path $XmlRoot 'sold'
    $nTool = @(Get-Files $toolSold @('.xml') -Recurse).Count
    $rbXhTool.Text = "Thư mục của tool: xml\sold ($nTool file)"
    if ($script:cfg.XhXmlFolder -and -not (Test-Path -LiteralPath $script:cfg.XhXmlFolder)) { $script:cfg.XhXmlFolder = '' }
    $txtXhFolder.Text = $script:cfg.XhXmlFolder
    if (-not $rbXhOther.Checked -and -not $rbXhTool.Checked) { if ($script:cfg.XhXmlFolder) { $rbXhOther.Checked = $true } else { $rbXhTool.Checked = $true } }
    $dir = if ($rbXhOther.Checked) { $script:cfg.XhXmlFolder } else { $toolSold }
    $xmls = if ($dir) { @(Get-Files $dir @('.xml') -Recurse) } else { @() }
    # dò chú thích "Bản QUY ĐỔI ĐVT" trên ≤ 300 file đầu (đọc 600 byte/file) — thư mục hàng nghìn XML vẫn nhanh
    $sample = @($xmls | Select-Object -First 300); $conv = @($sample | Where-Object { Test-Converted $_.FullName }).Count
    $btnXhAddXml.Enabled = $btnXhClearXml.Enabled = $rbXhTool.Checked
    if (-not $xmls.Count) { Set-StepStatus $x1 'bad' 'chưa có XML' }
    elseif ($conv -lt $sample.Count) { Set-StepStatus $x1 'warn' "$($xmls.Count) file — $($sample.Count - $conv)/$($sample.Count) chưa quy đổi" }
    else { Set-StepStatus $x1 'ok' "$($xmls.Count) file XML quy đổi" }
    $cats = @(Get-Files $CatalogDir @('.xlsx') | Sort-Object LastWriteTime -Descending)
    $stray = @((Get-InputGroups).StrayCatalog)
    if ($cats.Count) {
        $lblXhCat.Text = "Đang dùng: $($cats[0].Name)  ($($cats[0].LastWriteTime.ToString('dd/MM/yyyy HH:mm')))$(if ($cats.Count -gt 1) { " — còn $($cats.Count - 1) file cũ hơn (tool dùng file mới nhất)" })"
        Set-StepStatus $x2 'ok' 'có danh mục'
    } elseif ($stray.Count) {
        $lblXhCat.Text = "Đang nằm thẳng trong Input\: $(($stray | ForEach-Object Name) -join ', ') — tool sao kê sẽ coi là sao kê. Bấm 'Chọn file danh mục…' để chuyển."
        Set-StepStatus $x2 'warn' 'đặt sai thư mục'
    } else { $lblXhCat.Text = 'Chưa có danh mục.'; Set-StepStatus $x2 'none' 'tùy chọn' }
    $btnXhCatRemove.Enabled = [bool]$cats.Count
    $vda = [bool](Get-Process -Name Menu -ErrorAction SilentlyContinue)
    if ($vda) { Set-StepStatus $x3 'ok' 'VietDA đang mở' } else { Set-StepStatus $x3 'bad' 'VietDA chưa mở' }
    $ready = $xmls.Count -gt 0 -and $vda
    $btnXhCheck.Enabled = $ready -and -not (Test-Busy)
    $tip.SetToolTip($btnXhCheck, $(if ($ready) { 'Đọc từng phiếu trên VietDA, so với XML' } else { 'Cần Bước 1 (có XML) và Bước 3 (VietDA đang mở)' }))
    if (-not $script:xhChecked) { Set-StepStatus $x4 'none' 'chưa kiểm' }
}
function Update-BankSteps {
    $g = Get-InputGroups
    Fill-List $lstStm $g.Statements; Fill-List $lstRecon $g.Recon; Fill-List $lstObj $g.Objects
    if ($g.StrayCatalog.Count) { Set-StepStatus $b1 'warn' "$($g.Statements.Count) sao kê — có danh mục VTHH đặt nhầm trong Input" }
    elseif ($g.Statements.Count) { Set-StepStatus $b1 'ok' "$($g.Statements.Count) file sao kê" } else { Set-StepStatus $b1 'bad' 'chưa có sao kê' }
    if ($g.Recon.Count) { Set-StepStatus $b2 'ok' "$($g.Recon.Count) file" } else { Set-StepStatus $b2 'warn' 'chưa có (phiếu thu cần)' }
    if ($g.Objects.Count) { Set-StepStatus $b3 'ok' 'có danh mục' } else { Set-StepStatus $b3 'bad' 'chưa có' }
    $toolSold = @(Get-Files (Join-Path $XmlRoot 'sold') @('.xml') -Recurse).Count; $toolPur = @(Get-Files (Join-Path $XmlRoot 'purchase') @('.xml') -Recurse).Count
    $rbBankTool.Text = "Thư mục của tool: xml\sold ($toolSold file) + xml\purchase ($toolPur file)"
    if ($script:cfg.BankXmlFolder -and -not (Test-Path -LiteralPath $script:cfg.BankXmlFolder)) { $script:cfg.BankXmlFolder = '' }
    $txtBankFolder.Text = $script:cfg.BankXmlFolder
    if (-not $rbBankOther.Checked -and -not $rbBankTool.Checked) { if ($script:cfg.BankXmlFolder) { $rbBankOther.Checked = $true } else { $rbBankTool.Checked = $true } }
    $nXml = if ($rbBankOther.Checked) { @(Get-Files $script:cfg.BankXmlFolder @('.xml') -Recurse).Count } else { $toolSold + $toolPur }
    $btnBankAddSold.Enabled = $btnBankAddPur.Enabled = $rbBankTool.Checked
    if ($nXml) { Set-StepStatus $b4 'ok' "$nXml file XML" } else { Set-StepStatus $b4 'warn' 'chưa có XML' }
    $vda = [bool](Get-Process -Name Menu -ErrorAction SilentlyContinue)
    if ($vda) { Set-StepStatus $b5 'ok' 'VietDA đang mở' } else { Set-StepStatus $b5 'bad' 'VietDA chưa mở' }
    $ready = $g.Statements.Count -gt 0 -and $g.Objects.Count -gt 0 -and $vda -and -not (Test-Busy)
    $btnBankDry.Enabled = $btnBankVerify.Enabled = $btnBankCreate.Enabled = $ready
    $tip.SetToolTip($btnBankCreate, $(if ($ready) { 'Tạo phiếu trên VietDA' } else { 'Cần Bước 1 (sao kê), Bước 3 (danh mục Đối tượng) và VietDA đang mở' }))
}
function Update-All { Update-XhSteps; Update-BankSteps; Update-ReportButtons }

# ---------------- chạy / kết thúc ----------------
function Test-Busy { [bool]($script:runner -and $script:runner.Running) }
function Set-Running([bool]$On) {
    foreach ($c in @($x1.Box, $x2.Box, $x4.Box, $x5.Box, $b1.Box, $b2.Box, $b3.Box, $b4.Box, $b5.Box, $b6.Box)) { $c.Enabled = -not $On }
    $btnStop.Enabled = $On
    $progress.Style = if ($On) { 'Marquee' } else { 'Blocks' }
    $progress.Value = 0
    if (-not $On) { Update-All }
}
function Start-ToolRun([string]$Kind, [string]$Script, [string[]]$ScriptArgs, [string]$Title) {
    if (Test-Busy) { return }
    $quoted = @($ScriptArgs | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } })
    $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$Script`" " + ($quoted -join ' ')
    $script:job = @{ Kind = $Kind; Started = Get-Date }
    $script:readCount = 0
    Add-Log ''; Add-Log ">> $Title — $(Get-Date -Format 'HH:mm:ss')  ($([IO.Path]::GetFileName($Script)) $($quoted -join ' '))"
    Write-UiLog "Chạy $Kind`: $argLine"
    $script:runner = New-Object VdUiRunner
    try { $script:runner.Start($argLine, $ToolDir) }
    catch { Add-Log "[ERROR] Không chạy được: $($_.Exception.Message)"; Write-UiLog "Lỗi chạy $Kind`: $($_.Exception.Message)"; $script:runner = $null; return }
    Set-Running $true
    $lblStatus.Text = "$Title…"
    if ($Kind -like 'bank-*') { $form.WindowState = 'Minimized' }
    $timer.Start()
}
# tom-tat.txt của thư mục Output mới nhất tạo sau lúc bắt đầu chạy → @{ khóa = giá trị }
function Read-Summary {
    $script:lastOut = $null
    if (-not (Test-Path -LiteralPath $OutRoot)) { return @{} }
    $dir = @(Get-ChildItem -LiteralPath $OutRoot -Directory | Where-Object { $_.CreationTime -ge $script:job.Started.AddSeconds(-2) -and (Test-Path -LiteralPath (Join-Path $_.FullName 'tom-tat.txt')) } | Sort-Object CreationTime -Descending) | Select-Object -First 1
    if (-not $dir) { return @{} }
    $script:lastOut = $dir.FullName
    $sum = @{}
    foreach ($l in [IO.File]::ReadAllLines((Join-Path $dir.FullName 'tom-tat.txt'), [Text.Encoding]::UTF8)) { if ($l -match '^\s*([^:]+?)\s*:\s*(.*)$') { $sum[$Matches[1]] = $Matches[2].Trim() } }
    return $sum
}
function Get-Num($Sum, [string]$Key) { $n = 0; if ($Sum.ContainsKey($Key) -and [int]::TryParse(($Sum[$Key] -replace '\D.*$', ''), [ref]$n)) { $n } else { 0 } }

function Complete-Job([int]$Code) {
    $kind = $script:job.Kind
    $form.WindowState = 'Normal'; $form.Activate()
    $sum = Read-Summary
    Add-Log ">> Kết thúc (mã $Code)$(if ($script:lastOut) { " — kết quả: $script:lastOut" })"
    Write-UiLog "Xong $kind, mã $Code, output $script:lastOut"
    $fixOn = $false
    if ($kind -like 'xh-*') {
        if ($Code -ne 0 -or -not $sum.Count) {
            $lblXhResult.ForeColor = $red; $lblXhResult.Text = 'LỖI CHẠY TOOL — xem log bên dưới.'
            $script:xhChecked = $null; Set-StepStatus $x4 'bad' 'lỗi chạy'; $lblStatus.Text = 'Lỗi.'
        } else {
            $need = Get-Num $sum 'Cần sửa đầu phiếu'; $lineErr = Get-Num $sum 'Lỗi dòng'; $warn = Get-Num $sum 'Cảnh báo'
            $missing = Get-Num $sum 'Chưa nhập VietDA'; $noXml = Get-Num $sum 'Phiếu không có XML'; $fixErr = Get-Num $sum 'Sửa lỗi'
            $okN = Get-Num $sum 'OK'; $fixable = Get-Num $sum 'Phiếu có đầu phiếu tool sửa được'; $fixed = Get-Num $sum 'Tool đã sửa + Lưu'
            $fail = $need + $lineErr + $missing + $noXml + $fixErr
            $head = if ($kind -eq 'xh-fix') { "Đã sửa + Lưu $fixed phiếu. " } else { '' }
            if ($fail -eq 0) {
                $lblXhResult.ForeColor = $green
                $lblXhResult.Text = "$head" + "ĐẠT — $okN phiếu khớp XML$(if ($warn) { ", $warn phiếu có cảnh báo (xem Kết quả kiểm tra)" })."
                Set-StepStatus $x4 'ok' 'ĐẠT'
            } else {
                $lblXhResult.ForeColor = $red
                $parts = @()
                if ($fixable) { $parts += "$fixable phiếu sai đầu phiếu → Bước 5" }
                if ($lineErr) { $parts += "$lineErr phiếu lỗi dòng hàng (sửa tay)" }
                if ($missing) { $parts += "$missing HĐ chưa nhập VietDA" }
                if ($noXml) { $parts += "$noXml phiếu không có XML" }
                if ($fixErr) { $parts += "$fixErr phiếu sửa lỗi" }
                $lblXhResult.Text = "$head" + 'KHÔNG ĐẠT — ' + ($parts -join '; ') + '.' + $(if (-not $fixable) { ' Lỗi còn lại chỉ sửa tay (cột "So với XML").' } else { '' })
                Set-StepStatus $x4 'bad' 'KHÔNG ĐẠT'
            }
            # Sửa chỉ bật khi KHÔNG ĐẠT + còn đầu phiếu tool sửa được, cùng điều kiện của lần kiểm này
            $script:xhChecked = Get-XhKey
            $fixOn = ($fail -gt 0 -and $fixable -gt 0)
            $lblStatus.Text = 'Xong.'
        }
    } else {
        $lblBankResult.ForeColor = if ($Code -eq 0) { $green } else { $red }
        $lblBankResult.Text = if ($Code -ne 0) { 'LỖI / DỪNG — xem log bên dưới.' } elseif ($sum.Count) { (@($sum.Keys | Select-Object -First 5 | ForEach-Object { "$_ $($sum[$_])" }) -join ' · ') } else { 'Xong.' }
        if ($Code -eq 0) { Set-StepStatus $b6 'ok' 'xong' } else { Set-StepStatus $b6 'bad' 'lỗi / dừng' }
        $lblStatus.Text = if ($Code -eq 0) { 'Xong.' } else { 'Lỗi / dừng.' }
    }
    Set-Running $false
    $btnXhFix.Enabled = $fixOn
    if ($kind -like 'xh-*') { if ($fixOn) { Set-StepStatus $x5 'warn' 'có phiếu cần sửa' } elseif ($script:xhChecked) { Set-StepStatus $x5 'none' 'không cần / không sửa được' } }
}

$timer = New-Object System.Windows.Forms.Timer; $timer.Interval = 200
$timer.Add_Tick({
    if (-not $script:runner) { $timer.Stop(); return }
    $line = $null; $n = 0
    while ($n -lt 400 -and $script:runner.Lines.TryDequeue([ref]$line)) {
        Add-Log $line; $n++
        if ($line -match '\[(\d+)\] (XH\S+)') { $script:readCount = [int]$Matches[1]; $lblStatus.Text = "Đang đọc phiếu thứ $($Matches[1]) ($($Matches[2]))…" }
        elseif ($line -match '\[(INFO|WARN|OK)\]\s+(.{1,90})') { if ($script:job.Kind -like 'bank-*') { $lblStatus.Text = $Matches[2] } }
    }
    if (-not $script:runner.Running -and $script:runner.Lines.IsEmpty) {
        $timer.Stop()
        $code = $script:runner.Finish()
        while ($script:runner.Lines.TryDequeue([ref]$line)) { Add-Log $line }
        Complete-Job $code
    }
})

# ---------------- báo cáo ----------------
function Get-LatestReport([string]$Name) {
    if (-not (Test-Path -LiteralPath $OutRoot)) { return $null }
    @(Get-ChildItem -LiteralPath $OutRoot -Directory | ForEach-Object { Get-Item -LiteralPath (Join-Path $_.FullName $Name) -ErrorAction SilentlyContinue } | Where-Object { $_ } | Sort-Object LastWriteTime -Descending) | Select-Object -First 1
}
function Update-ReportButtons {
    foreach ($pair in @(@($btnXhReport, 'ket-qua-kiem-xh.xlsx', 'Chưa có kết quả — bấm Kiểm tra'), @($btnBankReport, 'ket-qua-chay.xlsx', 'Chưa có kết quả chạy'))) {
        $f = Get-LatestReport $pair[1]
        $pair[0].Enabled = [bool]$f -and -not (Test-Busy)
        $pair[0].Tag = if ($f) { $f.FullName } else { $null }
        $tip.SetToolTip($pair[0], $(if ($f) { "Mở $($f.Directory.Name)\$($f.Name) ($($f.LastWriteTime.ToString('dd/MM HH:mm')))" } else { $pair[2] }))
    }
}
$openReport = {
    param($s, $e)
    $f = [string]$s.Tag
    if (-not $f -or -not (Test-Path -LiteralPath $f)) { Update-ReportButtons; return }
    Write-UiLog "Mở báo cáo $f"
    try { Start-Process $f } catch { Show-Error "Không mở được $f`r`n$($_.Exception.Message)" }
}

# ---------------- sự kiện tab XH ----------------
function Get-XhKey { "$($rbXhOther.Checked)|$($script:cfg.XhXmlFolder)|$($chkXhAuto.Checked)|$($dtXhFrom.Value.ToString('dd/MM/yyyy'))|$($dtXhTo.Value.ToString('dd/MM/yyyy'))|$($numXhLimit.Value)" }
function Get-XhArgs {
    $a = @('-NoOpen')
    if ($rbXhOther.Checked -and $script:cfg.XhXmlFolder) { $a += @('-XmlFolder', $script:cfg.XhXmlFolder) }
    if (-not $chkXhAuto.Checked) { $a += @('-From', $dtXhFrom.Value.ToString('dd/MM/yyyy'), '-To', $dtXhTo.Value.ToString('dd/MM/yyyy')) }
    if ($numXhLimit.Value -gt 0) { $a += @('-Limit', [string][int]$numXhLimit.Value) }
    return , $a
}
# đổi đầu vào / điều kiện sau khi đã kiểm → phải Kiểm tra lại mới được Sửa
function Reset-XhCheck {
    if ($script:xhChecked -and $script:xhChecked -ne (Get-XhKey)) {
        $btnXhFix.Enabled = $false; $lblXhResult.ForeColor = $gray; $lblXhResult.Text = 'Đã đổi XML / điều kiện → bấm Kiểm tra lại.'
        $script:xhChecked = $null; Set-StepStatus $x4 'none' 'cần kiểm lại'; Set-StepStatus $x5 'none' ''
    }
}
$chkXhAuto.Add_CheckedChanged({ $dtXhFrom.Enabled = $dtXhTo.Enabled = -not $chkXhAuto.Checked; Reset-XhCheck })
$dtXhFrom.Add_ValueChanged({ Reset-XhCheck }); $dtXhTo.Add_ValueChanged({ Reset-XhCheck }); $numXhLimit.Add_ValueChanged({ Reset-XhCheck })
$rbXhTool.Add_CheckedChanged({ Update-XhSteps; Reset-XhCheck })
$rbXhOther.Add_Click({ if (-not $script:cfg.XhXmlFolder) { $f = Pick-Folder 'Chọn thư mục XML hóa đơn bán ra (quét cả thư mục con)' ''; if ($f) { $script:cfg.XhXmlFolder = $f; Save-Settings } else { $rbXhTool.Checked = $true } }; Update-XhSteps; Reset-XhCheck })
$btnXhPick.Add_Click({ $f = Pick-Folder 'Chọn thư mục XML hóa đơn bán ra (quét cả thư mục con)' $script:cfg.XhXmlFolder; if ($f) { $script:cfg.XhXmlFolder = $f; Save-Settings; $rbXhOther.Checked = $true }; Update-XhSteps; Reset-XhCheck })
$btnXhAddXml.Add_Click({ $fs = Pick-Files 'Chọn file XML hóa đơn bán ra (XML quy đổi)' 'XML hóa đơn (*.xml)|*.xml'; if ($fs.Count) { [void](Import-Files $fs (Join-Path $XmlRoot 'sold')); Update-XhSteps; Reset-XhCheck } })
$btnXhOpenXml.Add_Click({ & $openDir $(if ($rbXhOther.Checked -and $script:cfg.XhXmlFolder) { $script:cfg.XhXmlFolder } else { Join-Path $XmlRoot 'sold' }) })
$btnXhClearXml.Add_Click({
    $sold = Join-Path $XmlRoot 'sold'; $fs = @(Get-Files $sold @('.xml') -Recurse)
    if (-not $fs.Count) { return }
    if ([System.Windows.Forms.MessageBox]::Show($form, "Chuyển $($fs.Count) file XML trong xml\sold vào xml\sold\_cu\<ngày-giờ>\ (không xóa)?", 'Dọn XML cũ', 'YesNo', 'Question') -ne 'Yes') { return }
    Move-ToOld @($fs | ForEach-Object FullName) $sold; Update-XhSteps; Reset-XhCheck
})
$btnXhCatPick.Add_Click({
    $fs = Pick-Files 'Chọn file danh mục Vật tư hàng hóa xuất từ VietDA (.xlsx)' 'Excel (*.xlsx)|*.xlsx' $false
    if (-not $fs.Count) { return }
    $old = @(Get-Files $CatalogDir @('.xlsx') | ForEach-Object FullName)
    $stray = @((Get-InputGroups).StrayCatalog | ForEach-Object FullName)
    [void](Import-Files $fs $CatalogDir)
    $keep = @($fs | ForEach-Object { Join-Path $CatalogDir ([IO.Path]::GetFileName($_)) })
    $toOld = @($old + $stray | Where-Object { $keep -notcontains $_ })
    if ($toOld.Count) { Move-ToOld $toOld $CatalogDir }
    Update-All; Reset-XhCheck
})
$btnXhCatOpen.Add_Click({ & $openDir $CatalogDir })
$btnXhCatRemove.Add_Click({ $old = @(Get-Files $CatalogDir @('.xlsx') | ForEach-Object FullName); if ($old.Count) { Move-ToOld $old $CatalogDir }; Update-XhSteps })
$btnXhCheck.Add_Click({
    Update-XhSteps
    if (-not $btnXhCheck.Enabled) { return }
    $lblXhResult.ForeColor = $gray; $lblXhResult.Text = 'Đang kiểm tra…'; Set-StepStatus $x4 'none' 'đang chạy'
    Start-ToolRun 'xh-check' $XhScript (Get-XhArgs) 'Kiểm tra phiếu XH'
})
$btnXhFix.Add_Click({
    if ($script:xhChecked -ne (Get-XhKey)) { $btnXhFix.Enabled = $false; return }
    $msg = "Tool sẽ SỬA + LƯU đầu phiếu trên VietDA theo XML:`r`n  Lý do 'Doanh thu bán hàng', Ký hiệu, Số HĐ, Phương thức TT,`r`n  Ghi nợ (chuyển khoản 131 / tiền mặt 1111), Ghi có 33311`r`n  VietDA hỏi 'điền tự động TK dòng hàng' → Yes.`r`nDòng hàng KHÔNG sửa. Sau khi Lưu tool mở lại từng phiếu để kiểm.`r`n`r`nTrong lúc chạy KHÔNG bấm vào VietDA. Tiếp tục?"
    if ([System.Windows.Forms.MessageBox]::Show($form, $msg, 'Sửa + Lưu phiếu XH', 'YesNo', 'Warning') -ne 'Yes') { return }
    $lblXhResult.ForeColor = $gray; $lblXhResult.Text = 'Đang sửa + Lưu…'; Set-StepStatus $x5 'none' 'đang sửa'
    Start-ToolRun 'xh-fix' $XhScript ((Get-XhArgs) + @('-Fix', '-Yes')) 'Sửa + Lưu đầu phiếu XH'
})
$btnXhReport.Add_Click($openReport)

# ---------------- sự kiện tab sao kê ----------------
$btnStmAdd.Add_Click({ $fs = Pick-Files 'Chọn sao kê TPBank (.xlsx)' 'Sao kê Excel (*.xlsx)|*.xlsx'; if ($fs.Count) { [void](Import-Files $fs $InputDir); Update-BankSteps } })
$btnReconAdd.Add_Click({ $fs = Pick-Files 'Chọn Excel Đối soát CK (doi-soat-ck_*.xlsx)' 'Đối soát CK (*.xlsx;*.csv)|*.xlsx;*.csv'; if ($fs.Count) { [void](Import-Files $fs $InputDir 'doi-soat-ck_' '(?i)^doi-soat-ck'); Update-BankSteps } })
$btnObjAdd.Add_Click({ $fs = Pick-Files 'Chọn danh mục Đối tượng xuất từ VietDA (.xlsx)' 'Excel (*.xlsx)|*.xlsx' $false; if ($fs.Count) { [void](Import-Files $fs $InputDir 'DANH SACH_' '(?i)^DANH[ _-]?SACH|doi.?tuong'); Update-BankSteps } })
foreach ($pair in @(@($btnStmDel, $lstStm), @($btnReconDel, $lstRecon), @($btnObjDel, $lstObj))) {
    $pair[0].Tag = $pair[1]
    $pair[0].Add_Click({ param($s, $e) $sel = Get-Selected $s.Tag; if (-not $sel.Count) { Show-Error 'Chọn file trong danh sách trước.'; return }; Move-ToOld $sel $InputDir; Update-BankSteps })
}
$btnStmOpen.Add_Click({ & $openDir $InputDir })
$rbBankTool.Add_CheckedChanged({ Update-BankSteps })
$rbBankOther.Add_Click({ if (-not $script:cfg.BankXmlFolder) { $f = Pick-Folder 'Chọn thư mục XML hóa đơn (bán ra + mua vào, quét cả thư mục con)' ''; if ($f) { $script:cfg.BankXmlFolder = $f; Save-Settings } else { $rbBankTool.Checked = $true } }; Update-BankSteps })
$btnBankPick.Add_Click({ $f = Pick-Folder 'Chọn thư mục XML hóa đơn (bán ra + mua vào, quét cả thư mục con)' $script:cfg.BankXmlFolder; if ($f) { $script:cfg.BankXmlFolder = $f; Save-Settings; $rbBankOther.Checked = $true }; Update-BankSteps })
$btnBankAddSold.Add_Click({ $fs = Pick-Files 'Chọn XML hóa đơn BÁN RA' 'XML hóa đơn (*.xml)|*.xml'; if ($fs.Count) { [void](Import-Files $fs (Join-Path $XmlRoot 'sold')); Update-All } })
$btnBankAddPur.Add_Click({ $fs = Pick-Files 'Chọn XML hóa đơn MUA VÀO' 'XML hóa đơn (*.xml)|*.xml'; if ($fs.Count) { [void](Import-Files $fs (Join-Path $XmlRoot 'purchase')); Update-All } })
$btnBankOpenXml.Add_Click({ & $openDir $(if ($rbBankOther.Checked -and $script:cfg.BankXmlFolder) { $script:cfg.BankXmlFolder } else { $XmlRoot }) })
function Get-BankArgs {
    $a = @()
    switch ($cmbBankMode.SelectedIndex) { 1 { $a += @('-Mode', 'Thu') } 2 { $a += @('-Mode', 'Chi') } }
    if ($numBankLimit.Value -gt 0) { $a += @('-Limit', [string][int]$numBankLimit.Value) }
    if ($rbBankOther.Checked -and $script:cfg.BankXmlFolder) { $a += @('-XmlFolder', $script:cfg.BankXmlFolder) }
    return , $a
}
function Confirm-StrayCatalog {
    $stray = @((Get-InputGroups).StrayCatalog)
    if (-not $stray.Count) { return $true }
    $r = [System.Windows.Forms.MessageBox]::Show($form, "Trong Input\ có file giống danh mục Vật tư hàng hóa: $(($stray | ForEach-Object Name) -join ', ').`r`nTool sao kê sẽ coi là SAO KÊ. Chuyển sang Input\danh-muc-vthh\ rồi chạy?", 'File đặt nhầm', 'YesNoCancel', 'Warning')
    if ($r -eq 'Cancel') { return $false }
    if ($r -eq 'Yes') { foreach ($f in $stray) { if (-not (Test-Path $CatalogDir)) { New-Item -ItemType Directory $CatalogDir -Force | Out-Null }; Move-Item -LiteralPath $f.FullName -Destination $CatalogDir -Force }; Add-Log ">> Đã chuyển $($stray.Count) danh mục VTHH vào $CatalogDir"; Update-All }
    return $true
}
$btnBankDry.Add_Click({ if (-not (Confirm-StrayCatalog)) { return }; Set-StepStatus $b6 'none' 'đang chạy'; Start-ToolRun 'bank-dry' $BankScript ((Get-BankArgs) + @('-DryRun', '-Yes')) 'Sao kê: xem trước (không tạo phiếu)' })
$btnBankVerify.Add_Click({
    if (-not (Confirm-StrayCatalog)) { return }
    if ([System.Windows.Forms.MessageBox]::Show($form, "Tool sẽ mở bảng kê trên VietDA và xuất Excel để kiểm tra (không tạo phiếu).`r`nTool dùng chuột + bàn phím: KHÔNG đụng máy tới khi xong. Tiếp tục?", 'Chỉ kiểm tra VietDA', 'YesNo', 'Question') -ne 'Yes') { return }
    Set-StepStatus $b6 'none' 'đang chạy'; Start-ToolRun 'bank-verify' $BankScript ((Get-BankArgs) + @('-VerifyOnly', '-Yes')) 'Sao kê: kiểm tra VietDA'
})
$btnBankCreate.Add_Click({
    if (-not (Confirm-StrayCatalog)) { return }
    $msg = "Tool sẽ TẠO PHIẾU thu/chi tiền gửi trên VietDA$(if ($numBankLimit.Value -gt 0) { " ($([int]$numBankLimit.Value) phiếu đầu)" }), rồi kiểm tra lại.`r`nTrên VietDA phải đang mở đúng tab Phiếu thu / Phiếu chi tiền gửi.`r`nTool dùng chuột + bàn phím: KHÔNG đụng máy tới khi xong. Tiếp tục?"
    if ([System.Windows.Forms.MessageBox]::Show($form, $msg, 'Tạo phiếu', 'YesNo', 'Warning') -ne 'Yes') { return }
    Set-StepStatus $b6 'none' 'đang chạy'; Start-ToolRun 'bank-create' $BankScript ((Get-BankArgs) + @('-Yes')) 'Sao kê: tạo phiếu'
})
$btnBankReport.Add_Click($openReport)

# ---------------- chung ----------------
$btnStop.Add_Click({
    if (-not (Test-Busy)) { return }
    $warn = if ($script:job.Kind -in 'xh-fix', 'bank-create') { "`r`n`r`nĐang SỬA / TẠO phiếu: dừng giữa chừng có thể để lại phiếu đang mở chưa Lưu trên VietDA — kiểm lại VietDA sau khi dừng." } else { '' }
    if ([System.Windows.Forms.MessageBox]::Show($form, "Dừng tool đang chạy?$warn", 'Dừng', 'YesNo', 'Question') -ne 'Yes') { return }
    Add-Log '[WARN] Người dùng bấm Dừng.'; Write-UiLog "Dừng $($script:job.Kind)"
    $script:runner.Kill()
})
$btnOutDir.Add_Click({ $d = if ($script:lastOut) { $script:lastOut } elseif (Test-Path $OutRoot) { $OutRoot } else { $ToolDir }; Start-Process explorer.exe $d })
$tabs.Add_SelectedIndexChanged({ if (-not (Test-Busy)) { Update-All } })
$form.Add_Activated({ if (-not (Test-Busy) -and $script:shown) { Update-XhSteps; Update-BankSteps } })
$form.Add_Shown({ $script:shown = $true })
$form.Add_FormClosing({
    param($s, $e)
    if (Test-Busy) {
        if ([System.Windows.Forms.MessageBox]::Show($form, 'Tool đang chạy. Đóng cửa sổ sẽ DỪNG tool. Đóng?', 'Đóng', 'YesNo', 'Warning') -ne 'Yes') { $e.Cancel = $true; return }
        $script:runner.Kill()
    }
    Save-Settings
})

Update-All
Write-UiLog 'Mở cửa sổ VietDA Tools'
Add-Log ">> VietDA Tools — $ToolDir"
try { [void]$form.ShowDialog() }
catch { Write-UiLog "Lỗi cửa sổ: $($_.Exception.Message)"; [System.Windows.Forms.MessageBox]::Show("Lỗi: $($_.Exception.Message)", 'VietDA Tools') | Out-Null }
