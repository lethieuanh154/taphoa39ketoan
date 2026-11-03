<#
.SYNOPSIS
  Tự tạo phiếu thu/chi tiền gửi trên VietDA từ sao kê TPBank (.xlsx):
  - Ghi có  → Phiếu thu tiền gửi (báo có), lý do "Thu tiền bán hàng theo HD <số HĐĐT>" (số HĐĐT lấy từ CSV Đối soát CK).
  - Ghi nợ  → Phiếu chi tiền gửi (báo nợ), lý do "Chuyển trả tiền hàng theo HD <số HĐ>", đối tượng = người bán
              trong XML hóa đơn đầu vào (khớp theo "HD <số>" trong diễn giải sao kê).

.DESCRIPTION
  Mỗi lượt chạy làm 1 loại phiếu = loại phiếu đang mở ở tab chọn trên VietDA (mở Thu chi > Phiếu thu/chi tiền gửi).
  Grid "Chi tiết thu chi" chỉ nhận bàn phím → tool CHIẾM FOCUS VietDA, click + gõ phím như người.
  KHÔNG dùng chuột/bàn phím khi tool đang chạy; tool tự dừng nếu VietDA mất focus.

  Mỗi phiếu: (Thêm) → Ngày = ngày GD → Đối tượng → Lý do → Số tiền dòng 1 → kiểm Tổng thanh toán → Lưu.
  Chống tạo trùng theo Mã GD (sổ _vietda-ck-da-nhap.txt cạnh script), trừ khi -Force.
  Gặp hộp thoại hỏi (nhiều nút) hoặc thông báo lạ sau Lưu → DỪNG, để nguyên cho người dùng xử lý.

  Đối tượng: tool đọc danh mục bằng cách chọn lần lượt từng mã trong ô Đối tượng của phiếu đang mở (đọc tên).
  Người bán XML → mã: _vietda-map-mst.csv (MST;Mã, tự ghi tay) → mã = MST → tên trùng (bỏ dấu, hoa/thường).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -Statement sk.xlsx -Recon doi-soat-ck.csv -DryRun
  powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -Statement sk.xlsx -XmlFolder D:\HoaDonXML\MuaVao -Limit 1
#>
param(
    [string]$Statement,
    [string]$Recon,
    [string]$XmlFolder,
    [ValidateSet('', 'Thu', 'Chi')][string]$Mode = '',
    [string]$ReceiptObject = 'SMMM',
    [switch]$DryRun,
    [switch]$Force,
    [switch]$Yes,
    [switch]$NoSave,
    [int]$Limit = 0,
    [int[]]$AmountCell = @(280, 46),
    [int]$StepDelayMs = 250
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms, System.IO.Compression

if (-not ('Vdb' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class Vdb {
    const uint WM_SETTEXT = 0x0C, WM_GETTEXT = 0x0D, WM_GETTEXTLENGTH = 0x0E, WM_COMMAND = 0x111, WM_NULL = 0;
    const uint CB_GETCOUNT = 0x146, CB_GETLBTEXT = 0x148, CB_GETLBTEXTLEN = 0x149, CB_SETCURSEL = 0x14E;
    const uint SMTO_ABORTIFHUNG = 2;

    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr d, int id);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetFocus();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, StringBuilder l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, string l, uint f, uint t, out IntPtr r);

    public static string ClassOf(IntPtr h) { StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }
    public static int CtrlId(IntPtr h) { return GetDlgCtrlID(h); }
    public static RECT Rect(IntPtr h) { RECT r; GetWindowRect(h, out r); return r; }

    public static string TextOf(IntPtr h) {
        IntPtr len;
        if (SendMessageTimeout(h, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out len) == IntPtr.Zero) return "";
        StringBuilder sb = new StringBuilder(len.ToInt32() + 2);
        IntPtr r;
        SendMessageTimeout(h, WM_GETTEXT, (IntPtr)sb.Capacity, sb, SMTO_ABORTIFHUNG, 2000, out r);
        return sb.ToString();
    }

    public static bool SetText(IntPtr h, string s) {
        IntPtr r;
        return SendMessageTimeout(h, WM_SETTEXT, IntPtr.Zero, s, SMTO_ABORTIFHUNG, 2000, out r) != IntPtr.Zero;
    }

    public static bool IsIdle(IntPtr h) {
        IntPtr r;
        return SendMessageTimeout(h, WM_NULL, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 1000, out r) != IntPtr.Zero;
    }

    public static void Press(IntPtr dlg, int id) { PostMessage(dlg, WM_COMMAND, (IntPtr)id, GetDlgItem(dlg, id)); }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
    }

    // Không dùng mẹo bấm Alt (sẽ kích hoạt menu VietDA) → mượn input queue của cửa sổ đang foreground
    public static bool Activate(IntPtr h) {
        if (GetForegroundWindow() == h) return true;
        uint pid;
        uint fgThread = GetWindowThreadProcessId(GetForegroundWindow(), out pid);
        uint me = GetCurrentThreadId();
        bool attached = fgThread != 0 && fgThread != me && AttachThreadInput(me, fgThread, true);
        BringWindowToTop(h);
        SetForegroundWindow(h);
        if (attached) AttachThreadInput(me, fgThread, false);
        System.Threading.Thread.Sleep(200);
        return GetForegroundWindow() == h;
    }

    public static IntPtr FocusOf(IntPtr anyWnd) {
        uint pid;
        uint t = GetWindowThreadProcessId(anyWnd, out pid);
        uint me = GetCurrentThreadId();
        AttachThreadInput(me, t, true);
        IntPtr f = GetFocus();
        AttachThreadInput(me, t, false);
        return f;
    }

    public static IntPtr[] Descendants(IntPtr root) {
        List<IntPtr> list = new List<IntPtr>();
        EnumChildWindows(root, delegate(IntPtr h, IntPtr l) { list.Add(h); return true; }, IntPtr.Zero);
        return list.ToArray();
    }

    public static IntPtr[] Tops(int pid) {
        List<IntPtr> list = new List<IntPtr>();
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            uint p;
            GetWindowThreadProcessId(h, out p);
            if (p == (uint)pid && IsWindowVisible(h)) list.Add(h);
            return true;
        }, IntPtr.Zero);
        return list.ToArray();
    }

    public static IntPtr[] Dialogs(int pid) {
        List<IntPtr> list = new List<IntPtr>();
        foreach (IntPtr h in Tops(pid)) if (ClassOf(h) == "#32770") list.Add(h);
        return list.ToArray();
    }

    public static string MessageText(IntPtr dlg) {
        StringBuilder sb = new StringBuilder();
        bool found = false;
        foreach (IntPtr h in Descendants(dlg)) {
            if (GetDlgCtrlID(h) == 0xFFFF && ClassOf(h) == "Static") { found = true; sb.Append(TextOf(h)).Append(' '); }
        }
        return found ? sb.ToString().Replace("\r", " ").Replace("\n", " ").Trim() : null;
    }

    public static int ButtonCount(IntPtr dlg) {
        int n = 0;
        foreach (IntPtr h in Descendants(dlg)) if (ClassOf(h) == "Button" && IsWindowVisible(h)) n++;
        return n;
    }

    public static string[] ComboItems(IntPtr cb) {
        IntPtr n, r;
        SendMessageTimeout(cb, CB_GETCOUNT, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out n);
        int count = Math.Max(n.ToInt32(), 0);
        string[] items = new string[count];
        for (int i = 0; i < count; i++) {
            IntPtr len;
            SendMessageTimeout(cb, CB_GETLBTEXTLEN, (IntPtr)i, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out len);
            StringBuilder sb = new StringBuilder(Math.Max(len.ToInt32(), 0) + 2);
            SendMessageTimeout(cb, CB_GETLBTEXT, (IntPtr)i, sb, SMTO_ABORTIFHUNG, 2000, out r);
            items[i] = sb.ToString();
        }
        return items;
    }

    // CB_SETCURSEL không báo cho WinForms → tự gửi CBN_SELCHANGE (đồng bộ) để VietDA điền tên/địa chỉ
    public static void SelectCombo(IntPtr cb, int index) {
        IntPtr r;
        SendMessageTimeout(cb, CB_SETCURSEL, (IntPtr)index, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out r);
        int id = GetDlgCtrlID(cb) & 0xFFFF;
        SendMessageTimeout(GetParent(cb), WM_COMMAND, (IntPtr)(id | (1 << 16)), cb, SMTO_ABORTIFHUNG, 5000, out r);
    }

    [StructLayout(LayoutKind.Sequential)] struct CBINFO { public int cbSize; public RECT rcItem; public RECT rcButton; public int state; public IntPtr hwndCombo; public IntPtr hwndItem; public IntPtr hwndList; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [DllImport("user32.dll")] static extern bool GetComboBoxInfo(IntPtr h, ref CBINFO i);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);

    public static IntPtr ComboList(IntPtr cb) { CBINFO i = new CBINFO(); i.cbSize = Marshal.SizeOf(i); GetComboBoxInfo(cb, ref i); return i.hwndList; }
    public static bool IsDropped(IntPtr cb) { IntPtr r; SendMessageTimeout(cb, 0x157, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out r); return r != IntPtr.Zero; }
    public static void CloseDrop(IntPtr cb) { IntPtr r; SendMessageTimeout(cb, 0x14F, IntPtr.Zero, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out r); }
    [DllImport("user32.dll")] static extern bool RedrawWindow(IntPtr h, IntPtr rc, IntPtr rgn, uint f);
    // RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN
    public static void Repaint(IntPtr h) { RedrawWindow(h, IntPtr.Zero, IntPtr.Zero, 0x0001 | 0x0100 | 0x0080); }
    public static int ListMsg(IntPtr lb, uint msg, int w) { IntPtr r; SendMessageTimeout(lb, msg, (IntPtr)w, IntPtr.Zero, SMTO_ABORTIFHUNG, 2000, out r); return r.ToInt32(); }
    // Vùng client của list trên màn hình: x, y, w, h
    public static int[] ClientScreen(IntPtr h) { RECT r; GetClientRect(h, out r); POINT p = new POINT(); ClientToScreen(h, ref p); return new int[] { p.X, p.Y, r.R, r.B }; }
}
"@
}

# ---------- OCR (Windows.Media.Ocr có sẵn trên Windows 10/11) — đọc menu & cột MST của list Đối tượng (VietDA tự vẽ, không có text) ----------
$script:ocrEngine = $null
function Init-Ocr {
    if ($script:ocrEngine) { return }
    Add-Type -AssemblyName System.Runtime.WindowsRuntime, System.Drawing
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $script:asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
    $script:ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $script:ocrEngine) { throw 'Windows OCR không khả dụng trên máy này' }
}

function Await-WinRt($Op, [Type]$T) { $task = $script:asTask.MakeGenericMethod($T).Invoke($null, @($Op)); [void]$task.Wait(-1); $task.Result }

# Chụp vùng màn hình, phóng to $Scale lần rồi OCR → các dòng { Text, X, Y } (tọa độ màn hình, tâm dòng)
function Ocr-Screen([int]$X, [int]$Y, [int]$W, [int]$H, [int]$Scale = 3) {
    Init-Ocr
    $bmp = New-Object Drawing.Bitmap $W, $H
    $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($X, $Y, 0, 0, $bmp.Size); $g.Dispose()
    $big = New-Object Drawing.Bitmap ($W * $Scale), ($H * $Scale)
    $g = [Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($bmp, 0, 0, $big.Width, $big.Height); $g.Dispose(); $bmp.Dispose()
    $ms = New-Object IO.MemoryStream
    $big.Save($ms, [Drawing.Imaging.ImageFormat]::Png); $big.Dispose()
    $ras = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $wr = New-Object Windows.Storage.Streams.DataWriter($ras.GetOutputStreamAt(0))
    $wr.WriteBytes($ms.ToArray())
    [void](Await-WinRt ($wr.StoreAsync()) ([uint32]))
    $dec = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sbmp = Await-WinRt ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $res = Await-WinRt ($script:ocrEngine.RecognizeAsync($sbmp)) ([Windows.Media.Ocr.OcrResult])
    foreach ($l in $res.Lines) {
        $words = @($l.Words | ForEach-Object { $_ })
        $r0 = $words[0].BoundingRect
        $r1 = $words[$words.Count - 1].BoundingRect
        [pscustomobject]@{
            Text = $l.Text
            X = [int]($X + ($r0.X + ($r1.X + $r1.Width - $r0.X) / 2) / $Scale)
            Y = [int]($Y + ($r0.Y + $r0.Height / 2) / $Scale)
            Words = @($words | ForEach-Object { [pscustomobject]@{ Text = $_.Text; X = [int]($X + ($_.BoundingRect.X + $_.BoundingRect.Width / 2) / $Scale); Y = [int]($Y + ($_.BoundingRect.Y + $_.BoundingRect.Height / 2) / $Scale) } })
        }
    }
}

# OCR hay nhầm chữ/số: O,o,D,Q,C → 0; I,l,| → 1; S → 5; B → 8. Nhận MST 10 số / 10-3 / CCCD 12 số.
function Get-OcrMst([string]$Text) {
    foreach ($tok in ($Text -split '\s+' | Sort-Object { -$_.Length })) {
        $t = $tok -replace '[OoDQC]', '0' -replace '[Il|]', '1' -replace 'S', '5' -replace 'B', '8'
        $m = [regex]::Match($t, '\d{10}-\d{3}|\d{12}|\d{10}')
        if ($m.Success) { return $m.Value }
    }
    return ''
}

$ToolDir = $PSScriptRoot
$LogFile = Join-Path $ToolDir '_vietda-ck-import.log'
$LedgerFile = Join-Path $ToolDir '_vietda-ck-da-nhap.txt'
$MapFile = Join-Path $ToolDir '_vietda-map-mst.csv'
$ObjectsFile = Join-Path $ToolDir '_vietda-doi-tuong.csv'
$FormTitles = @{ 'Phiếu thu tiền gửi' = 'Thu'; 'Phiếu chi tiền gửi' = 'Chi' }
$ReasonPrefix = @{ Thu = 'Thu tiền bán hàng theo HD '; Chi = 'Chuyển trả tiền hàng theo HD ' }

function Write-Log([string]$Level, [string]$Message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $Level, $Message
    $color = @{ INFO = 'Gray'; OK = 'Green'; WARN = 'Yellow'; ERROR = 'Red' }[$Level]
    Write-Host $line -ForegroundColor $color
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Fail([string]$Message) { Write-Log ERROR $Message; exit 1 }

# "CÔNG TY TNHH  Thương mại..." → "CONG TY TNHH THUONG MAI..." để so tên người bán XML với danh mục VietDA
function Normalize-Name([string]$s) {
    if (-not $s) { return '' }
    $d = $s.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $d.ToCharArray()) {
        if ([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($ch) }
    }
    $t = $sb.ToString().Replace('Đ', 'D').Replace('đ', 'd').ToUpperInvariant()
    return (($t -replace '[^A-Z0-9]+', ' ').Trim())
}

function Pick-File([string]$Title, [string]$Filter) {
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Title = $Title
    $dlg.Filter = $Filter
    if ($dlg.ShowDialog() -ne 'OK') { Fail "Đã hủy: $Title" }
    return $dlg.FileName
}

function Pick-Folder([string]$Title) {
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description = $Title
    if ($dlg.ShowDialog() -ne 'OK') { Fail "Đã hủy: $Title" }
    return $dlg.SelectedPath
}

# ---------- Sao kê TPBank (.xlsx) — cùng layout utils/tpbank-statement.util.ts ----------
# A = Ngày GD (dd/mm/yyyy hh:mm:ss), C = Diễn giải, D = Ghi nợ, E = Ghi có, H = Chủ TK đối ứng, I = Mã GD
function Read-Statement([string]$Path) {
    # FileShare.ReadWrite: đọc được cả khi file đang mở trong Excel
    $fs = New-Object IO.FileStream($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    $zip = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Read)
    try {
        $readEntry = {
            param($name)
            $e = $zip.GetEntry($name)
            if (-not $e) { return $null }
            $r = New-Object IO.StreamReader($e.Open(), [Text.Encoding]::UTF8)
            try { $r.ReadToEnd() } finally { $r.Dispose() }
        }
        $sheetXml = & $readEntry 'xl/worksheets/sheet1.xml'
        if (-not $sheetXml) { throw 'không thấy xl/worksheets/sheet1.xml' }
        $shared = @()
        $ssXml = & $readEntry 'xl/sharedStrings.xml'
        if ($ssXml) {
            $ss = New-Object Xml.XmlDocument
            $ss.LoadXml($ssXml)
            $shared = @($ss.SelectNodes("//*[local-name()='si']") | ForEach-Object { $_.InnerText })
        }
    } finally { $zip.Dispose() }

    $doc = New-Object Xml.XmlDocument
    $doc.LoadXml($sheetXml)
    $txns = New-Object System.Collections.Generic.List[object]
    foreach ($row in $doc.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
        $cells = @{}
        foreach ($c in $row.ChildNodes) {
            if ($c.LocalName -ne 'c') { continue }
            $col = ($c.GetAttribute('r') -replace '\d', '')
            $type = $c.GetAttribute('t')
            $v = $c.SelectSingleNode("*[local-name()='v']")
            if ($type -eq 'inlineStr') { $cells[$col] = $c.InnerText }
            elseif ($type -eq 's' -and $v) { $cells[$col] = $shared[[int]$v.InnerText] }
            elseif ($v) { $cells[$col] = $v.InnerText }
        }
        $a = [string]$cells['A']
        if ($a -notmatch '^(\d{2})/(\d{2})/(\d{4}) \d{2}:\d{2}:\d{2}$') { continue }
        $num = {
            param($x)
            $d = 0.0
            if ($x -and [double]::TryParse($x, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { [long][Math]::Round($d) } else { 0L }
        }
        $txns.Add([pscustomobject]@{
            DateTime = $a
            Date = ('{0}/{1}/{2}' -f $Matches[1], $Matches[2], $Matches[3])
            Desc = ([string]$cells['C']).Trim()
            Debit = (& $num $cells['D'])
            Credit = (& $num $cells['E'])
            Counterparty = ([string]$cells['H']).Trim()
            Code = ([string]$cells['I']).Trim()
        })
    }
    return $txns
}

# ---------- CSV Đối soát CK (bank-reconciliation-page, buildReconCsv) → Mã GD → số HĐĐT ----------
function Read-Recon([string]$Path) {
    $map = @{}
    $clean = { param($s) $s = [string]$s; if ($s -match "^'[=+\-@]") { $s.Substring(1) } else { $s.Trim() } }
    foreach ($r in Import-Csv -LiteralPath $Path -Delimiter ';' -Encoding UTF8) {
        $code = & $clean $r.'Mã GD'
        if (-not $code) { continue }
        if (-not $map.ContainsKey($code)) { $map[$code] = New-Object System.Collections.Generic.List[object] }
        $map[$code].Add([pscustomobject]@{
            Number = & $clean $r.'Số HĐĐT'
            Serial = & $clean $r.'Ký hiệu HĐĐT'
            Code = & $clean $r.'Mã HĐ'
            Kind = & $clean $r.'Trạng thái'
        })
    }
    if ($map.Count -eq 0) { throw "không có dòng nào có cột 'Mã GD' — có đúng file CSV Đối soát CK (doi-soat-ck_*.csv) không?" }
    return $map
}

# ---------- XML hóa đơn đầu vào (quét cả thư mục con) ----------
function Read-PurchaseXml([string]$Folder) {
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($f in Get-ChildItem -LiteralPath $Folder -Filter *.xml -File -Recurse | Where-Object { $_.Extension -eq '.xml' }) {
        try {
            $xml = New-Object Xml.XmlDocument
            $xml.Load($f.FullName)
            $pick = { param($xp) $n = $xml.SelectSingleNode($xp); if ($n) { $n.InnerText.Trim() } else { '' } }
            $so = & $pick "//*[local-name()='TTChung']/*[local-name()='SHDon']"
            $soNum = 0L
            if (-not [long]::TryParse($so, [ref]$soNum)) { continue }
            $total = 0.0
            [void][double]::TryParse((& $pick "//*[local-name()='TToan']/*[local-name()='TgTTTBSo']"), [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$total)
            $list.Add([pscustomobject]@{
                Number = $soNum
                Symbol = (& $pick "//*[local-name()='TTChung']/*[local-name()='KHMSHDon']") + (& $pick "//*[local-name()='TTChung']/*[local-name()='KHHDon']")
                Date = & $pick "//*[local-name()='TTChung']/*[local-name()='NLap']"
                SellerMst = & $pick "//*[local-name()='NBan']/*[local-name()='MST']"
                SellerName = & $pick "//*[local-name()='NBan']/*[local-name()='Ten']"
                Total = [long][Math]::Round($total)
                File = $f.Name
            })
        } catch {
            Write-Log WARN "Bỏ qua XML lỗi $($f.Name): $($_.Exception.Message)"
        }
    }
    return $list
}

# "...thanh toan tien hang theo HD 40978" / "HD 123, 124 va 125" → 40978 / 123,124,125
function Get-DescInvoiceNumbers([string]$Desc) {
    $m = [regex]::Match($Desc, '(?i)\bH\.?D\.?\s*(?:so\s*)?:?\s*(\d+(?:\s*(?:,|;|&|\+|/|-|va|và)\s*\d+)*)')
    if (-not $m.Success) { return @() }
    return @([regex]::Matches($m.Groups[1].Value, '\d+') | ForEach-Object { [long]$_.Value })
}

function Find-DebitInvoices($Txn, $Xmls) {
    $nums = Get-DescInvoiceNumbers $Txn.Desc
    $cp = Normalize-Name $Txn.Counterparty
    if ($nums.Count) {
        $chosen = New-Object System.Collections.Generic.List[object]
        foreach ($n in $nums) {
            $c = @($Xmls | Where-Object { $_.Number -eq $n })
            if ($c.Count -gt 1) {
                $byAmount = @($c | Where-Object { $_.Total -eq $Txn.Debit })
                $byName = @($c | Where-Object { $cp -and (Normalize-Name $_.SellerName).Contains(($cp -replace '^(CONG TY|CTY) ', '')) })
                if ($byAmount.Count -eq 1) { $c = $byAmount } elseif ($byName.Count -eq 1) { $c = $byName }
            }
            if ($c.Count -eq 0) { return @{ Error = "không có XML hóa đơn số $n trong thư mục XML" } }
            if ($c.Count -gt 1) { return @{ Error = "có $($c.Count) XML cùng số HĐ $n, không phân biệt được ($(($c | ForEach-Object { $_.File }) -join ', '))" } }
            $chosen.Add($c[0])
        }
        return @{ Invoices = $chosen; By = 'số HĐ' }
    }
    $d = [datetime]::ParseExact($Txn.Date, 'dd/MM/yyyy', $null)
    $c = @($Xmls | Where-Object {
        $_.Total -eq $Txn.Debit -and $_.Date -and
        ([datetime]$_.Date.Substring(0, 10)) -le $d -and ([datetime]$_.Date.Substring(0, 10)) -ge $d.AddDays(-120)
    })
    if ($c.Count -eq 1) { return @{ Invoices = $c; By = 'số tiền' } }
    if ($c.Count -gt 1) { return @{ Error = "diễn giải không có 'HD <số>', $($c.Count) XML cùng số tiền" } }
    return @{ Error = "diễn giải không có 'HD <số>', không có XML cùng số tiền" }
}

# ---------- VietDA ----------
# Cửa sổ chính VietDA (đã đăng nhập: có MDICLIENT) + phiếu thu/chi tiền gửi đang hiện ở tab chọn (nếu có)
function Find-Vietda {
    foreach ($p in Get-Process -Name Menu, Main -ErrorAction SilentlyContinue) {
        foreach ($top in [Vdb]::Tops($p.Id)) {
            if ([Vdb]::ClassOf($top) -notlike '*Window.8*') { continue }
            $kids = [Vdb]::Descendants($top)
            if (-not ($kids | Where-Object { [Vdb]::ClassOf($_) -like '*MDICLIENT*' })) { continue }
            $v = [pscustomobject]@{ Pid = $p.Id; Main = $top; Form = [IntPtr]::Zero; Kind = ''; Title = '' }
            foreach ($h in $kids) {
                if (-not [Vdb]::IsWindowVisible($h) -or [Vdb]::ClassOf($h) -notlike '*Window.8*') { continue }
                $t = [Vdb]::TextOf($h)
                if ($FormTitles.ContainsKey($t)) { $v.Form = $h; $v.Kind = $FormTitles[$t]; $v.Title = $t; break }
            }
            return $v
        }
    }
    return $null
}

# Menu VietDA tự vẽ (không có text/UIA) → OCR thanh menu tìm "Thu chi", click, OCR menu xổ tìm mục "(báo có)" / "(báo nợ)"
function Open-Form([string]$Kind) {
    $v = Find-Vietda
    if ($v -and $v.Kind -eq $Kind) { return $v }
    if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
    $bar = @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::GetParent($_) -eq $script:vda.Main -and [Vdb]::IsWindowVisible($_) } |
        ForEach-Object { $r = [Vdb]::Rect($_); [pscustomobject]@{ H = $_; L = $r.L; T = $r.T; W = $r.R - $r.L; Ht = $r.B - $r.T } } |
        Where-Object { $_.Ht -ge 15 -and $_.Ht -le 40 } | Sort-Object T) | Select-Object -First 1
    if (-not $bar) { throw 'không thấy thanh menu VietDA' }
    $line = @(Ocr-Screen $bar.L $bar.T ([Math]::Min($bar.W, 900)) $bar.Ht 3)
    $words = @($line | ForEach-Object { $_.Words })
    $hit = $null
    for ($i = 0; $i -lt $words.Count - 1; $i++) { if ($words[$i].Text -match '^Thu$' -and $words[$i + 1].Text -match '^chi') { $hit = $words[$i]; break } }
    if (-not $hit) { throw "OCR không thấy menu 'Thu chi' (đọc được: $(($line | ForEach-Object { $_.Text }) -join ' / '))" }

    $before = @{}
    foreach ($t in [Vdb]::Tops($script:vda.Pid)) { $before[$t.ToInt64()] = $true }
    Assert-Foreground
    [Vdb]::Click($hit.X + 10, $hit.Y)
    $drop = $null
    $wait = (Get-Date).AddSeconds(3)
    while (-not $drop -and (Get-Date) -lt $wait) {
        Start-Sleep -Milliseconds 200
        $drop = @([Vdb]::Tops($script:vda.Pid) | Where-Object { -not $before.ContainsKey($_.ToInt64()) -and [Vdb]::ClassOf($_) -notlike '*Shadow*' }) | Select-Object -First 1
    }
    if (-not $drop) { throw "bấm 'Thu chi' nhưng menu không xổ xuống" }
    Start-Sleep -Milliseconds 300
    $r = [Vdb]::Rect($drop)
    $items = @(Ocr-Screen $r.L $r.T ($r.R - $r.L) ($r.B - $r.T) 3)
    $want = if ($Kind -eq 'Thu') { '(?i)^Phi\S*\s+thu\s+.*\(b' } else { '(?i)^Phi\S*\s+chi\s+.*\(b' }
    $item = @($items | Where-Object { $_.Text -match $want }) | Select-Object -First 1
    if (-not $item) {
        [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        throw "OCR không thấy mục Phiếu $($Kind.ToLower()) tiền gửi trong menu (đọc được: $(($items | ForEach-Object { $_.Text }) -join ' / '))"
    }
    Assert-Foreground
    [Vdb]::Click($item.X, $item.Y)
    $wait = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $wait) {
        Start-Sleep -Milliseconds 300
        $v = Find-Vietda
        if ($v -and $v.Kind -eq $Kind) { Start-Sleep -Milliseconds 500; return $v }
    }
    throw "đã bấm menu nhưng không thấy phiếu $Kind mở ra"
}

function Get-Controls($Form) {
    $kids = foreach ($h in [Vdb]::Descendants($Form)) {
        if ([Vdb]::GetParent($h) -ne $Form -or -not [Vdb]::IsWindowVisible($h)) { continue }
        $r = [Vdb]::Rect($h)
        [pscustomobject]@{ H = $h; Cls = [Vdb]::ClassOf($h); Text = ([Vdb]::TextOf($h) -replace '&(?=\S)', ''); L = $r.L; T = $r.T; R = $r.R; B = $r.B; CY = ($r.T + $r.B) / 2 }
    }
    $find = { param($cls, $text) @($kids | Where-Object { $_.Cls -like "*$cls*" -and $_.Text -eq $text }) | Select-Object -First 1 }
    $rightOf = {
        param($ref, $cls)
        if (-not $ref) { return $null }
        @($kids | Where-Object { $_.Cls -like "*$cls*" -and $_.L -ge $ref.R - 8 -and $_.H -ne $ref.H -and [Math]::Abs($_.CY - $ref.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
    }
    $innerEdit = { param($cb) if ($cb) { $e = @([Vdb]::Descendants($cb.H) | Where-Object { [Vdb]::ClassOf($_) -eq 'Edit' }) | Select-Object -First 1; if ($e) { [pscustomobject]@{ H = $e } } } }

    $c = @{}
    $c.SoCt = & $rightOf (& $find 'STATIC' 'Số CT') 'EDIT'
    $c.Date = & $rightOf (& $find 'STATIC' 'Ngày') 'SysDateTimePick32'
    $c.Object = & $rightOf (& $find 'STATIC' 'Đối tượng') 'COMBOBOX'
    $c.ObjectName = & $rightOf $c.Object 'EDIT'
    $c.Reason = & $rightOf (& $find 'STATIC' 'Lý do') 'COMBOBOX'
    $c.Total = & $rightOf (& $find 'BUTTON' 'Tổng thanh toán') 'EDIT'
    $c.Save = & $find 'BUTTON' 'Lưu'
    $c.New = & $find 'BUTTON' 'Thêm'
    $detail = & $find 'BUTTON' 'Chi tiết thu chi'
    if ($detail) { $c.Grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and $_.T -ge $detail.B - 4 -and ($_.B - $_.T) -gt 100 } | Sort-Object T) | Select-Object -First 1 }
    $missing = @('SoCt', 'Date', 'Object', 'ObjectName', 'Reason', 'Total', 'Save', 'New', 'Grid' | Where-Object { -not $c[$_] })
    if ($missing.Count) { throw "không nhận ra control trên phiếu: $($missing -join ', ') (VietDA đổi giao diện?)" }
    $c.ObjectEdit = & $innerEdit $c.Object
    $c.ReasonEdit = & $innerEdit $c.Reason
    if (-not $c.ObjectEdit -or -not $c.ReasonEdit) { throw 'không thấy ô nhập trong combobox Đối tượng/Lý do' }
    return $c
}

function Digits([string]$s) { $d = $s -replace '\D', ''; if ($d) { [long]$d } else { 0L } }

# Danh mục đối tượng. List xổ xuống (mã | tên | địa chỉ | MST) là list tự vẽ, chỉ có text = mã:
#  - MST: click nút xổ (VietDA chỉ nạp list khi click thật), cuộn list bằng LB_SETTOPINDEX, OCR cột MST từng dòng.
#  - Tên: chọn từng mã bằng message (CBN_SELCHANGE) rồi đọc ô tên.
function Read-Objects($C) {
    $cb = $C.Object.H
    if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
    if (-not [Vdb]::IsDropped($cb)) {
        Assert-Foreground
        $r = [Vdb]::Rect($cb)
        [Vdb]::Click($r.R - 9, [int](($r.T + $r.B) / 2))
    }
    $wait = (Get-Date).AddSeconds(5)
    while (([Vdb]::ComboItems($cb).Count -eq 0 -or -not [Vdb]::IsDropped($cb)) -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    $codes = [Vdb]::ComboItems($cb)
    if ($codes.Count -eq 0) { [Vdb]::CloseDrop($cb); throw 'list Đối tượng trống (VietDA không nạp danh mục?)' }

    $msts = @{}
    try {
        Start-Sleep -Milliseconds 300
        $lb = [Vdb]::ComboList($cb)
        $ih = [Vdb]::ListMsg($lb, 0x1A1, 0)
        $cs = [Vdb]::ClientScreen($lb)
        $rows = [int][Math]::Floor($cs[3] / [Math]::Max($ih, 1))
        if ($ih -le 0 -or $rows -le 0) { throw "list Đối tượng không đo được (itemHeight=$ih, cao=$($cs[3]))" }
        $x0 = $cs[0] + [int]($cs[2] * 0.76)
        for ($top = 0; $top -lt $codes.Count; $top += $rows) {
            [void][Vdb]::ListMsg($lb, 0x197, $top)
            # VietDA vẽ lại list trễ sau khi cuộn → ép vẽ + chụp lại trang nếu còn >= 2 dòng chưa ra MST
            # (1 dòng trống có thể là thật: cá nhân / khách lẻ không có MST)
            for ($attempt = 1; $attempt -le 3; $attempt++) {
                Start-Sleep -Milliseconds (150 * $attempt)
                [Vdb]::Repaint($lb)
                $real = [Vdb]::ListMsg($lb, 0x18E, 0)
                $blank = 0
                for ($k = 0; $k -lt $rows; $k++) {
                    $idx = $real + $k
                    if ($idx -ge $codes.Count) { break }
                    if ($msts[$idx]) { continue }
                    $text = (@(Ocr-Screen $x0 ($cs[1] + $k * $ih) ($cs[0] + $cs[2] - $x0) $ih 4) | ForEach-Object { $_.Text }) -join ' '
                    $msts[$idx] = Get-OcrMst $text
                    if (-not $msts[$idx]) { $blank++ }
                }
                if ($blank -lt 2) { break }
            }
        }
    } finally {
        [Vdb]::CloseDrop($cb)
    }

    $list = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt $codes.Count; $i++) {
        [Vdb]::SelectCombo($cb, $i)
        $name = [Vdb]::TextOf($C.ObjectName.H)
        $list.Add([pscustomobject]@{ Code = $codes[$i]; Name = $name; Norm = Normalize-Name $name; Mst = [string]$msts[$i] })
    }
    [Vdb]::SelectCombo($cb, -1)
    return $list
}

function Resolve-Object($Mst, $Name, $Objects, $ManualMap) {
    if ($ManualMap.ContainsKey($Mst)) { return @{ Code = $ManualMap[$Mst]; By = '_vietda-map-mst.csv' } }
    $n = Normalize-Name $Name
    $byMst = @($Objects | Where-Object { $_.Mst -eq $Mst -or $_.Code -eq $Mst })
    if ($byMst.Count -eq 1) { return @{ Code = $byMst[0].Code; By = 'MST' } }
    if ($byMst.Count -gt 1) {
        $named = @($byMst | Where-Object { $_.Norm -eq $n })
        if ($named.Count -eq 1) { return @{ Code = $named[0].Code; By = 'MST + tên' } }
        return @{ Error = "$($byMst.Count) mã cùng MST $Mst ($(($byMst | ForEach-Object { $_.Code }) -join ', ')) — ghi MST;Mã vào _vietda-map-mst.csv" }
    }
    $byName = @($Objects | Where-Object { $_.Norm -and $_.Norm -eq $n })
    if ($byName.Count -eq 1) { return @{ Code = $byName[0].Code; By = 'tên' } }
    if ($byName.Count -gt 1) { return @{ Error = "$($byName.Count) mã cùng tên '$Name' ($(($byName | ForEach-Object { $_.Code }) -join ', ')) — ghi MST;Mã vào _vietda-map-mst.csv" } }
    return @{ Error = "chưa có đối tượng MST $Mst '$Name' trong danh mục VietDA — thêm đối tượng hoặc ghi MST;Mã vào _vietda-map-mst.csv" }
}

function New-Result([string]$Status, [string]$Message) { [pscustomobject]@{ Status = $Status; Message = $Message } }

function Escape-Keys([string]$s) { [regex]::Replace($s, '[+^%~(){}\[\]]', { param($m) '{' + $m.Value + '}' }) }

function Assert-Foreground {
    if ([Vdb]::GetForegroundWindow() -eq $script:vda.Main) { return }
    if ([Vdb]::Dialogs($script:vda.Pid).Count) { throw 'VietDA đang mở hộp thoại' }
    throw 'VietDA mất focus (có bấm chuột/bàn phím chỗ khác?)'
}

function Send-Keys([string]$Keys) {
    Assert-Foreground
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
    Start-Sleep -Milliseconds $StepDelayMs
}

function Click-Control($Ctl, [int]$Dx = -1, [int]$Dy = -1) {
    Assert-Foreground
    $r = [Vdb]::Rect($Ctl.H)
    $x = if ($Dx -ge 0) { $r.L + $Dx } else { [int](($r.L + $r.R) / 2) }
    $y = if ($Dy -ge 0) { $r.T + $Dy } else { [int](($r.T + $r.B) / 2) }
    [Vdb]::Click($x, $y)
    Start-Sleep -Milliseconds $StepDelayMs
}

# Ô chữ: WM_SETTEXT (không qua bộ gõ Unikey/Telex) rồi Tab ra để WinForms nhận giá trị; không được thì gõ phím
function Set-Field($Edit, [string]$Value, [scriptblock]$Check) {
    Click-Control $Edit
    [void][Vdb]::SetText($Edit.H, $Value)
    Send-Keys '{END}{TAB}'
    if (& $Check) { return $true }
    Click-Control $Edit
    Send-Keys ('{END}+{HOME}{DEL}' + (Escape-Keys $Value) + '{TAB}')
    return [bool](& $Check)
}

# Bấm nút bằng chuột rồi chờ VietDA xong: thông báo 1 nút → ghi lại + OK; câu hỏi nhiều nút → FATAL (để nguyên)
function Invoke-Button($Button, [string]$What, [int]$TimeoutSec = 60) {
    Click-Control $Button
    $notes = New-Object System.Collections.Generic.List[string]
    $pressed = @{}
    $idle = 0
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $dialogs = @([Vdb]::Dialogs($script:vda.Pid) | Where-Object { -not $pressed.ContainsKey($_.ToInt64()) -or ((Get-Date) - $pressed[$_.ToInt64()]).TotalSeconds -gt 3 })
        if ($dialogs.Count -eq 0) {
            if ([Vdb]::IsIdle($script:vda.Main)) { $idle++ } else { $idle = 0 }
            if ($idle -ge 3) { return New-Result OK ($notes -join ' | ') }
            Start-Sleep -Milliseconds 200
            continue
        }
        $idle = 0
        Start-Sleep -Milliseconds 200
        foreach ($d in $dialogs) {
            $text = [Vdb]::MessageText($d)
            $title = [Vdb]::TextOf($d)
            if ($null -eq $text -or [Vdb]::ButtonCount($d) -gt 1) { return New-Result FATAL "VietDA hỏi sau khi bấm $What — [$title] $text (để nguyên cho người dùng xử lý)" }
            $notes.Add("[$title] $text")
            [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 }))
            $pressed[$d.ToInt64()] = Get-Date
        }
        if ([Vdb]::GetForegroundWindow() -ne $script:vda.Main) { [void][Vdb]::Activate($script:vda.Main) }
    }
    return New-Result FATAL "quá $TimeoutSec giây sau khi bấm $What"
}

function Invoke-Voucher($Item) {
    $c = $script:ctl
    if (-not [Vdb]::Activate($script:vda.Main)) { return New-Result FATAL 'không đưa được VietDA lên trước (foreground)' }
    # phiếu trước đã Lưu + Thêm → phiếu đang mở phải trống
    if ((Digits ([Vdb]::TextOf($c.Total.H))) -ne 0) { return New-Result FATAL "phiếu đang mở đã có dữ liệu (Tổng thanh toán $([Vdb]::TextOf($c.Total.H))) — bấm Thêm/mở phiếu mới rồi chạy lại" }

    Click-Control $c.Date 10
    Send-Keys $Item.Date
    if ([Vdb]::TextOf($c.Date.H) -ne $Item.Date) { return New-Result FATAL "không đặt được Ngày (đọc lại: '$([Vdb]::TextOf($c.Date.H))')" }

    $ok = Set-Field $c.ObjectEdit $Item.Object { ([Vdb]::TextOf($c.ObjectEdit.H) -eq $Item.Object) -and [Vdb]::TextOf($c.ObjectName.H) }
    if (-not $ok) { return New-Result FATAL "không chọn được Đối tượng $($Item.Object) (đọc lại: '$([Vdb]::TextOf($c.ObjectEdit.H))' / '$([Vdb]::TextOf($c.ObjectName.H))')" }

    $ok = Set-Field $c.ReasonEdit $Item.Reason { [Vdb]::TextOf($c.ReasonEdit.H) -eq $Item.Reason }
    if (-not $ok) { return New-Result FATAL "không nhập được Lý do (đọc lại: '$([Vdb]::TextOf($c.ReasonEdit.H))')" }

    Click-Control $c.Grid $AmountCell[0] $AmountCell[1]
    Send-Keys "$($Item.Amount){TAB}"
    # Tổng thanh toán cập nhật trễ sau khi rời ô
    $wait = (Get-Date).AddSeconds(3)
    do {
        $total = Digits ([Vdb]::TextOf($c.Total.H))
        if ($total -eq $Item.Amount) { break }
        Start-Sleep -Milliseconds 200
    } while ((Get-Date) -lt $wait)
    if ($total -ne $Item.Amount) { return New-Result FATAL "Tổng thanh toán = $total, cần $($Item.Amount) — ô Số tiền dòng 1 không ở vị trí -AmountCell $($AmountCell -join ',')? (để nguyên phiếu, chưa Lưu)" }
    if ([Vdb]::TextOf($c.Date.H) -ne $Item.Date -or [Vdb]::TextOf($c.ObjectEdit.H) -ne $Item.Object) { return New-Result FATAL 'Ngày/Đối tượng bị đổi sau khi nhập số tiền (để nguyên phiếu, chưa Lưu)' }

    $soCt = [Vdb]::TextOf($c.SoCt.H)
    if ($NoSave) { return New-Result NOSAVE "đã điền phiếu $soCt, KHÔNG Lưu (-NoSave) — kiểm tra rồi Thoát không lưu" }
    # Lưu thành công: VietDA KHÔNG hiện gì, phiếu giữ nguyên dữ liệu (đã thử 03/11/2026)
    $r = Invoke-Button $c.Save 'Lưu'
    if ($r.Status -ne 'OK') { return $r }
    if ($r.Message -and $r.Message -notmatch '(?i)thành công|đã lưu|đã ghi') { return New-Result FATAL "VietDA báo sau khi Lưu: $($r.Message) — kiểm tra phiếu $soCt" }

    # Xác nhận đã lưu bằng nút Thêm: phiếu chưa lưu thì VietDA hỏi "Bạn có muốn lưu dữ liệu không?" (Yes/No).
    # Số CT nhảy cả khi bỏ phiếu không lưu → không dùng số CT để xác nhận.
    $r = Invoke-Button $c.New 'Thêm'
    if ($r.Status -ne 'OK') {
        if ($r.Message -match 'lưu dữ liệu') { return New-Result FATAL "phiếu $soCt CHƯA lưu được (bấm Thêm VietDA hỏi lưu) — xem phiếu, tự chọn Yes/No trên hộp thoại" }
        return $r
    }
    $wait = (Get-Date).AddSeconds(5)
    while (((Digits ([Vdb]::TextOf($c.Total.H))) -ne 0 -or [Vdb]::TextOf($c.SoCt.H) -eq $soCt) -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    if ((Digits ([Vdb]::TextOf($c.Total.H))) -ne 0 -or [Vdb]::TextOf($c.SoCt.H) -eq $soCt) { return New-Result FATAL "đã Lưu $soCt nhưng bấm Thêm không ra phiếu mới — kiểm tra phiếu $soCt trên VietDA" }
    return New-Result OK $soCt
}

# ================= main =================
Write-Log INFO "===== Bắt đầu$(if ($DryRun) { ' (DRY RUN)' })"

$script:vda = Find-Vietda
if (-not $script:vda) { Fail 'Không thấy VietDA đã đăng nhập (Menu.exe) — mở VietDA, đăng nhập rồi chạy lại.' }
if ([Vdb]::Dialogs($script:vda.Pid).Count) { Fail 'VietDA đang mở hộp thoại — đóng nó rồi chạy lại.' }
$modes = @(if ($Mode) { $Mode } else { 'Thu'; 'Chi' })

if (-not $Statement) { $Statement = Pick-File 'Chọn file sao kê TPBank (.xlsx)' 'Sao kê TPBank (*.xlsx)|*.xlsx' }
if ($modes -contains 'Thu' -and -not $Recon) { $Recon = Pick-File 'Chọn file CSV Đối soát CK (doi-soat-ck_*.csv)' 'CSV đối soát (*.csv)|*.csv' }
if ($modes -contains 'Chi' -and -not $XmlFolder) { $XmlFolder = Pick-Folder 'Chọn thư mục XML hóa đơn đầu vào' }
foreach ($p in @($Statement, $Recon) | Where-Object { $_ }) { if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Fail "Không thấy file: $p" } }
if ($XmlFolder -and -not (Test-Path -LiteralPath $XmlFolder -PathType Container)) { Fail "Không thấy thư mục: $XmlFolder" }

try { $txns = Read-Statement $Statement } catch { Fail "Đọc sao kê lỗi: $($_.Exception.Message)" }
Write-Log INFO "Sao kê $(Split-Path $Statement -Leaf): $($txns.Count) GD, Ghi có $(@($txns | Where-Object { $_.Credit -gt 0 }).Count), Ghi nợ $(@($txns | Where-Object { $_.Debit -gt 0 }).Count)."
if ($modes -contains 'Thu') {
    try { $reconMap = Read-Recon $Recon } catch { Fail "Đọc CSV đối soát lỗi: $($_.Exception.Message)" }
    Write-Log INFO "CSV đối soát $(Split-Path $Recon -Leaf): $($reconMap.Count) Mã GD."
}
if ($modes -contains 'Chi') {
    $xmls = @(Read-PurchaseXml $XmlFolder)
    Write-Log INFO "Thư mục XML $XmlFolder`: $($xmls.Count) hóa đơn."
}

$manualMap = @{}
if (Test-Path -LiteralPath $MapFile) {
    foreach ($line in Get-Content -LiteralPath $MapFile -Encoding UTF8) {
        $parts = $line -split '[;,\t]'
        if ($parts.Count -ge 2 -and $parts[0].Trim() -match '^\d') { $manualMap[$parts[0].Trim()] = $parts[1].Trim() }
    }
}
$done = @{}
if ((Test-Path -LiteralPath $LedgerFile) -and -not $Force) {
    foreach ($line in Get-Content -LiteralPath $LedgerFile -Encoding UTF8) { $k = ($line -split "`t")[0]; if ($k) { $done[$k] = $true } }
}

# Danh mục Đối tượng (chung phiếu thu & chi) đọc trên phiếu mở đầu tiên — cần click thật vào list
Write-Log INFO 'Mở phiếu + đọc danh mục Đối tượng — KHÔNG đụng chuột/bàn phím...'
try {
    $script:vda = Open-Form $modes[0]
    $script:ctl = Get-Controls $script:vda.Form
    if ((Digits ([Vdb]::TextOf($script:ctl.Total.H))) -ne 0) { throw "phiếu '$($script:vda.Title)' đang mở đã có dữ liệu (Tổng thanh toán $([Vdb]::TextOf($script:ctl.Total.H))) — bấm Thêm (phiếu mới) hoặc Thoát không lưu rồi chạy lại" }
    $objects = @(Read-Objects $script:ctl)
} catch { Fail $_.Exception.Message }
$withMst = @($objects | Where-Object { $_.Mst }).Count
Write-Log INFO "Danh mục Đối tượng: $($objects.Count) mã, OCR đọc được MST $withMst mã (xem $(Split-Path $ObjectsFile -Leaf))."
$objects | ForEach-Object { '{0};{1};{2}' -f $_.Code, $_.Mst, $_.Name } | Set-Content -LiteralPath $ObjectsFile -Encoding UTF8

if ($modes -contains 'Thu') {
    if (-not $ReceiptObject) {
        $sm = @($objects | Where-Object { $_.Norm -match '\bSONG MINH\b' })
        if ($sm.Count -ne 1) { Fail "Không xác định được mã Đối tượng Song Minh cho phiếu thu ($($sm.Count) mã có tên chứa 'SONG MINH') — chạy lại với -ReceiptObject <mã>." }
        $ReceiptObject = $sm[0].Code
        Write-Log INFO "Đối tượng phiếu thu: $ReceiptObject ($($sm[0].Name))"
    } elseif (-not ($objects | Where-Object { $_.Code -eq $ReceiptObject })) { Fail "-ReceiptObject $ReceiptObject không có trong danh mục Đối tượng." }
}

function Build-Queue([string]$M) {
    $queue = New-Object System.Collections.Generic.List[object]
    $skipped = New-Object System.Collections.Generic.List[string]
    $skippedLedger = 0
    $side = if ($M -eq 'Thu') { @($txns | Where-Object { $_.Credit -gt 0 }) } else { @($txns | Where-Object { $_.Debit -gt 0 }) }
    foreach ($t in $side) {
        $key = if ($t.Code) { "$M|$($t.Code)" } else { "$M|$($t.DateTime)|$($t.Debit + $t.Credit)|$($t.Desc)" }
        if ($done.ContainsKey($key)) { $skippedLedger++; continue }
        $label = "$($t.DateTime) $('{0:N0}' -f ($t.Debit + $t.Credit)) $($t.Code)"
        if ($M -eq 'Thu') {
            $inv = if ($t.Code -and $reconMap.ContainsKey($t.Code)) { @($reconMap[$t.Code] | Where-Object { $_.Number }) } else { @() }
            if ($inv.Count -eq 0) {
                $why = if ($t.Code -and $reconMap.ContainsKey($t.Code)) { "chưa có số HĐĐT ($(($reconMap[$t.Code] | ForEach-Object { "$($_.Kind) $($_.Code)".Trim() }) -join ', '))" } else { 'không có trong CSV đối soát (GD thừa / khác ngày?)' }
                $skipped.Add("$label — $why")
                continue
            }
            $numbers = @($inv | ForEach-Object { $_.Number } | Select-Object -Unique)
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Credit; Object = $ReceiptObject; Reason = $ReasonPrefix.Thu + ($numbers -join ', '); Label = $label; Note = '' })
        } else {
            $hit = Find-DebitInvoices $t $xmls
            if ($hit.Error) { $skipped.Add("$label '$($t.Desc)' — $($hit.Error)"); continue }
            $sellers = @($hit.Invoices | ForEach-Object { $_.SellerMst } | Select-Object -Unique)
            if ($sellers.Count -gt 1) { $skipped.Add("$label — các HĐ thuộc nhiều người bán ($($sellers -join ', '))"); continue }
            $first = $hit.Invoices[0]
            $obj = Resolve-Object $first.SellerMst $first.SellerName $objects $manualMap
            if ($obj.Error) { $skipped.Add("$label — $($obj.Error)"); continue }
            $sum = ($hit.Invoices | Measure-Object Total -Sum).Sum
            $note = "$($first.SellerName) [khớp HĐ theo $($hit.By), mã theo $($obj.By)]$(if ($sum -ne $t.Debit) { " · LỆCH: tổng HĐ $('{0:N0}' -f $sum)" })"
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Debit; Object = $obj.Code; Reason = $ReasonPrefix.Chi + (($hit.Invoices | ForEach-Object { $_.Number }) -join ', '); Label = $label; Note = $note })
        }
    }
    if ($skippedLedger) { Write-Log INFO "[$M] Bỏ qua $skippedLedger GD đã tạo phiếu ở lần chạy trước ($(Split-Path $LedgerFile -Leaf); -Force để làm lại)." }
    foreach ($s in $skipped) { Write-Log WARN "[$M] Không tạo phiếu: $s" }
    if ($Limit -gt 0 -and $queue.Count -gt $Limit) { $queue = @($queue | Select-Object -First $Limit) }
    Write-Log INFO "[$M] Sẽ tạo $($queue.Count) phiếu$(if ($Limit -gt 0) { " (-Limit $Limit)" }), bỏ qua $($skipped.Count) GD."
    $i = 0
    foreach ($q in $queue) { $i++; Write-Log INFO ("  [{0}] {1} → {2} | {3}{4}" -f $i, $q.Label, $q.Object, $q.Reason, $(if ($q.Note) { " | $($q.Note)" })) }
    $arr = [object[]]@(foreach ($x in $queue) { $x })
    return , $arr
}

$queues = @{}
foreach ($m in $modes) { $queues[$m] = Build-Queue $m }
$total = ($modes | ForEach-Object { $queues[$_].Count } | Measure-Object -Sum).Sum

if ($DryRun) { Write-Log INFO '===== DRY RUN xong, chưa tạo phiếu nào.'; exit 0 }
if ($total -eq 0) { Write-Log INFO '===== Không có phiếu nào cần tạo.'; exit 0 }
if (-not $Yes) {
    $answer = Read-Host "Tạo $total phiếu ($(($modes | ForEach-Object { "$_ $($queues[$_].Count)" }) -join ', '))? Tool sẽ chiếm chuột/bàn phím, KHÔNG đụng vào máy tới khi xong. Gõ Y rồi Enter"
    if ($answer -notmatch '^[yY]$') { Write-Log INFO '===== Không đồng ý — chưa tạo phiếu nào.'; exit 0 }
}

$ok = 0
$stopped = $false
foreach ($m in $modes) {
    $queue = $queues[$m]
    if ($queue.Count -eq 0) { continue }
    try {
        $script:vda = Open-Form $m
        $script:ctl = Get-Controls $script:vda.Form
    } catch { Write-Log ERROR "[$m] DỪNG: không mở được phiếu: $($_.Exception.Message)"; $stopped = $true; break }
    $i = 0
    foreach ($q in $queue) {
        $i++
        $sw = [Diagnostics.Stopwatch]::StartNew()
        try { $result = Invoke-Voucher $q } catch { $result = New-Result FATAL $_.Exception.Message }
        if ($result.Status -eq 'NOSAVE') { Write-Log WARN "[$m] $($q.Label) — $($result.Message)"; $stopped = $true; break }
        if ($result.Status -ne 'OK') { Write-Log ERROR "[$m $i/$($queue.Count)] $($q.Label) — DỪNG: $($result.Message)"; $stopped = $true; break }
        $ok++
        Add-Content -LiteralPath $LedgerFile -Value ("{0}`t{1}`t{2}`t{3}`t{4:yyyy-MM-dd HH:mm:ss}" -f $q.Key, $result.Message, $q.Amount, $q.Reason, (Get-Date)) -Encoding UTF8
        Write-Log OK ("[$m $i/$($queue.Count)] $($result.Message) — $($q.Label) → $($q.Object) | $($q.Reason) ({0:N1}s)" -f $sw.Elapsed.TotalSeconds)
    }
    if ($stopped) { break }
}

Write-Log INFO "===== Kết thúc: tạo $ok/$total phiếu."
if ($stopped) { exit 2 }
exit 0
