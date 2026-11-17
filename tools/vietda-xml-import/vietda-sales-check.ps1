<#
.SYNOPSIS
  Kiểm phiếu XH (Hóa đơn bán và phiếu xuất kho) trên VietDA sau khi Hội nhập XML hóa đơn bán ra — so với XML + danh mục
  Vật tư hàng hóa, KHÔNG sửa gì trên VietDA (09/11/2026).

.DESCRIPTION
  1. Đọc XML bán ra trong <tool>\xml (hoặc Input\xml) — nên dùng XML QUY ĐỔI (trang Đối soát hóa đơn > XML quy đổi), đúng bản
     đã Hội nhập vào VietDA. XML gốc vẫn chạy được nhưng chỉ so tiền / thuế (SL, mã sẽ khác).
  2. Đọc danh mục Vật tư hàng hóa xuất từ VietDA (.xlsx có dòng "DANH MỤC VẬT TƯ - HÀNG HÓA") trong Input\.
  3. VietDA: Nhập xuất > Tìm kiếm chứng từ > Loại XH, khoảng ngày của XML > Hiển thị → danh sách chứng từ.
     Lần lượt từng dòng: chọn dòng > Sửa phiếu (như double-click) → đọc phiếu: đầu phiếu (Số CT, Lý do, Ký hiệu, Số HĐ,
     Ghi nợ / Ghi có, Phương thức TT, MST, ô tick "Hiển thị thuế suất từng mặt hàng") + từng ô của lưới dòng hàng (Mã hàng,
     SL, Tiền hàng, TK Nợ/Có, Tiền vốn, Nợ/Có GV, Tiền VAT — F2 mở ô rồi Esc, không sửa) → Thoát → dòng kế.
     Gửi message thẳng vào control VietDA: sau bước mở menu, VietDA bị che vẫn chạy được — chỉ cần KHÔNG bấm vào VietDA.
  4. Ghép phiếu ↔ XML theo Ký hiệu + Số HĐ trên phiếu (không có thì ngày + tiền hàng + thuế + số dòng), so từng dòng.
  Kết quả: Output\<ngày-giờ>_kiem-xh\ket-qua-kiem-xh.xlsx (sheet Phieu + Loi-dong) + tom-tat.txt + phieu-vietda.json
  (chạy lại phần so sánh không cần VietDA: -FromForms <file phieu-vietda.json>).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File vietda-sales-check.ps1
  powershell -ExecutionPolicy Bypass -File vietda-sales-check.ps1 -From 01/10/2026 -To 31/10/2026
  powershell -ExecutionPolicy Bypass -File vietda-sales-check.ps1 -Limit 3
  powershell -ExecutionPolicy Bypass -File vietda-sales-check.ps1 -Fix -Limit 3     (SỬA + LƯU đầu phiếu, hỏi Y trước)
  powershell -ExecutionPolicy Bypass -File vietda-sales-check.ps1 -FromForms Output\2026-11-09_101500_kiem-xh\phieu-vietda.json
#>
param(
    [string]$From,
    [string]$To,
    [string]$XmlFolder,
    [string]$Catalog,
    [string]$FromForms,
    [switch]$Fix,
    [switch]$Yes,
    [int]$Limit = 0,
    [int]$FormTimeoutSec = 60,
    [int]$StepDelayMs = 250,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms, System.IO.Compression

# ======== Chép NGUYÊN VĂN từ vietda-bank-import.ps1 (Win32 / Excel COM / OCR / xlsx / click-gõ phím) — sửa bên kia thì xem lại đây ========
# --- vietda-bank-import.ps1 dòng 57–289 ---
# cmd mặc định font raster (Terminal) chỉ có ký tự bảng mã 437 → tiếng Việt thành "?" dù đã chcp 65001; đổi font cửa sổ này sang Consolas
if (-not ('ConFont' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class ConFont {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct INFO { public uint cbSize; public uint nFont; public short X; public short Y; public uint Family; public uint Weight;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Face; }
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll")] static extern bool GetCurrentConsoleFontEx(IntPtr h, bool max, ref INFO i);
    [DllImport("kernel32.dll")] static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref INFO i);
    public static string UseTrueType(string face) {
        IntPtr h = GetStdHandle(-11);
        INFO i = new INFO(); i.cbSize = (uint)Marshal.SizeOf(i);
        if (!GetCurrentConsoleFontEx(h, false, ref i)) return "không đọc được font console";
        if ((i.Family & 4) != 0) return null;
        string old = i.Face;
        i.nFont = 0; i.X = 0; i.Y = (short)(i.Y < 14 ? 16 : i.Y); i.Family = 54; i.Weight = 400; i.Face = face;
        return SetCurrentConsoleFontEx(h, false, ref i) ? null : "không đổi được font console " + old + " → " + face;
    }
}
"@
}
$fontNote = $null
if (-not [Console]::IsOutputRedirected) { try { $fontNote = [ConFont]::UseTrueType('Consolas') } catch { $fontNote = "đổi font console lỗi: $($_.Exception.Message)" } }

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
    // BM_CLICK: bấm nút WinForms không cần chuột/focus
    public static void ClickButton(IntPtr b) { PostMessage(b, 0xF5, IntPtr.Zero, IntPtr.Zero); }

    // Cửa sổ (gốc) đang nằm trên điểm (x,y) — phát hiện thông báo Chrome / Zalo / Windows đè lên nút VietDA trước khi click
    [StructLayout(LayoutKind.Sequential)] public struct PT { public int X; public int Y; }
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(PT p);
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    public static IntPtr RootAt(int x, int y) { PT p; p.X = x; p.Y = y; IntPtr h = WindowFromPoint(p); return h == IntPtr.Zero ? h : GetAncestor(h, 2); }
    public static int PidOf(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return (int)pid; }

    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(0x0002, 0, 0, 0, IntPtr.Zero);
        mouse_event(0x0004, 0, 0, 0, IntPtr.Zero);
    }

    // Không dùng mẹo bấm Alt (sẽ kích hoạt menu VietDA) → mượn input queue của cửa sổ đang foreground
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    public static bool Activate(IntPtr h) {
        // VietDA bị thu nhỏ → tọa độ -32000, chụp OCR ra ảnh rỗng: khôi phục trước (SW_RESTORE)
        if (IsIconic(h)) { ShowWindow(h, 9); System.Threading.Thread.Sleep(500); }
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


    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport("gdi32.dll")] static extern int GetDeviceCaps(IntPtr dc, int i);
    // Windows Scale 125%/150%: tọa độ của tool (DPI-unaware) đã thu nhỏ, còn ảnh chụp màn hình là pixel thật → hệ số = DESKTOPHORZRES / HORZRES
    public static double ScreenScale() { IntPtr dc = GetDC(IntPtr.Zero); int l = GetDeviceCaps(dc, 8), p = GetDeviceCaps(dc, 118); ReleaseDC(IntPtr.Zero, dc); return l > 0 && p > 0 ? (double)p / l : 1; }
}
"@
}

# --- vietda-bank-import.ps1 dòng 291–336 ---
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
# X/Y/W/H và kết quả theo tọa độ của tool; chụp theo pixel thật (× $script:screenScale) để đúng khi Windows Scale ≠ 100%
$script:screenScale = [Vdb]::ScreenScale()
function Ocr-Screen([int]$X, [int]$Y, [int]$W, [int]$H, [int]$Scale = 3) {
    Init-Ocr
    $s = $script:screenScale
    $bmp = New-Object Drawing.Bitmap ([Math]::Max(1, [int][Math]::Round($W * $s))), ([Math]::Max(1, [int][Math]::Round($H * $s)))
    $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen([int][Math]::Round($X * $s), [int][Math]::Round($Y * $s), 0, 0, $bmp.Size); $g.Dispose()
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
# --- vietda-bank-import.ps1 dòng 374–393 ---
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
# --- vietda-bank-import.ps1 dòng 427–513 ---
# Tên sheet → file XML trong .xlsx, theo thứ tự (xl/workbook.xml + xl/_rels/workbook.xml.rels). File Excel lưu lại có thể đổi
# tên file sheetN.xml / thêm sharedStrings → luôn tra theo tên sheet, không đoán sheetN.
function Get-XlsxSheetMap($ReadEntry) {
    $list = New-Object System.Collections.Generic.List[object]
    $wbXml = & $ReadEntry 'xl/workbook.xml'
    $relXml = & $ReadEntry 'xl/_rels/workbook.xml.rels'
    if (-not $wbXml -or -not $relXml) { return , $list }
    $wb = New-Object Xml.XmlDocument; $wb.LoadXml($wbXml)
    $rel = New-Object Xml.XmlDocument; $rel.LoadXml($relXml)
    $targets = @{}
    foreach ($r in $rel.SelectNodes("//*[local-name()='Relationship']")) { $targets[$r.GetAttribute('Id')] = $r.GetAttribute('Target') }
    foreach ($s in $wb.SelectNodes("//*[local-name()='sheets']/*[local-name()='sheet']")) {
        $id = $s.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $t = [string]$targets[$id]
        if (-not $t) { continue }
        $t = if ($t.StartsWith('/')) { $t.TrimStart('/') } else { 'xl/' + $t }
        $list.Add([pscustomobject]@{ Name = $s.GetAttribute('name'); Entry = $t })
    }
    return , $list
}

# Tên các sheet của .xlsx (không đọc ô)
function Get-XlsxSheetNames([string]$Path) {
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
        return @((Get-XlsxSheetMap $readEntry) | ForEach-Object { $_.Name })
    } finally { $zip.Dispose() }
}

# Ô 1 sheet của .xlsx (mặc định sheet đầu; -Sheet = tên sheet) → mỗi dòng 1 hashtable { 'A' = …, 'B' = … } (đọc thẳng XML, không cần Excel)
function Read-XlsxRows([string]$Path, [string]$Sheet = '') {
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
        $map = Get-XlsxSheetMap $readEntry
        if ($Sheet) {
            $hit = @($map | Where-Object { $_.Name -eq $Sheet })
            if (-not $hit.Count) { throw "không có sheet '$Sheet' (có: $(($map | ForEach-Object { $_.Name }) -join ', '))" }
            $entry = $hit[0].Entry
        } else {
            $entry = if ($map.Count) { $map[0].Entry } else { 'xl/worksheets/sheet1.xml' }
        }
        $sheetXml = & $readEntry $entry
        if (-not $sheetXml) { throw "không thấy $entry" }
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
    $rows = New-Object System.Collections.Generic.List[object]
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
        $rows.Add($cells)
    }
    return , $rows
}
# --- vietda-bank-import.ps1 dòng 855–903 ---
function New-Result([string]$Status, [string]$Message) { [pscustomobject]@{ Status = $Status; Message = $Message } }

function Escape-Keys([string]$s) { [regex]::Replace($s, '[+^%~(){}\[\]]', { param($m) '{' + $m.Value + '}' }) }

$script:extraFg = [IntPtr]::Zero
function Assert-Foreground {
    $fg = [Vdb]::GetForegroundWindow()
    if ($fg -eq $script:vda.Main -or ($script:extraFg -ne [IntPtr]::Zero -and $fg -eq $script:extraFg)) { return }
    if ([Vdb]::Dialogs($script:vda.Pid).Count) { throw 'VietDA đang mở hộp thoại' }
    throw 'VietDA mất focus (có bấm chuột/bàn phím chỗ khác?)'
}

function Send-Keys([string]$Keys) {
    Assert-Foreground
    [System.Windows.Forms.SendKeys]::SendWait($Keys)
    Start-Sleep -Milliseconds $StepDelayMs
}

# Thông báo (Chrome, Zalo, Windows…) đè lên điểm sắp click → chờ nó tự tắt (tối đa $CoverWaitSec giây) rồi mới click;
# vẫn còn → dừng, ghi tên cửa sổ đè (để tắt thông báo app đó). Không click vào cửa sổ của app khác.
$CoverWaitSec = 30
function Wait-Uncovered([int]$X, [int]$Y) {
    $deadline = $null
    $warned = $false
    while ($true) {
        $h = [Vdb]::RootAt($X, $Y)
        if ($h -eq [IntPtr]::Zero -or [Vdb]::PidOf($h) -eq $script:vda.Pid) { break }
        $who = try { "$((Get-Process -Id ([Vdb]::PidOf($h)) -ErrorAction Stop).ProcessName) '$([Vdb]::TextOf($h))' [$([Vdb]::ClassOf($h))]" } catch { "[$([Vdb]::ClassOf($h))]" }
        if (-not $deadline) { $deadline = (Get-Date).AddSeconds($CoverWaitSec) }
        if (-not $warned) { Write-Log WARN "Cửa sổ $who đè lên chỗ tool sắp click ($X,$Y) — chờ nó tắt (tối đa $CoverWaitSec giây)…"; $warned = $true }
        if ((Get-Date) -gt $deadline) { throw "cửa sổ $who đè lên nút VietDA quá $CoverWaitSec giây — tắt thông báo của app đó (Windows: Settings > System > Notifications / Focus assist) rồi chạy lại" }
        Start-Sleep -Milliseconds 500
    }
    if ($warned) {
        Write-Log INFO 'Cửa sổ đè đã tắt — click tiếp.'
        if ([Vdb]::GetForegroundWindow() -ne $script:vda.Main -and -not ($script:extraFg -ne [IntPtr]::Zero -and [Vdb]::GetForegroundWindow() -eq $script:extraFg)) { [void][Vdb]::Activate($script:vda.Main) }
        Assert-Foreground
    }
}

function Click-Control($Ctl, [int]$Dx = -1, [int]$Dy = -1) {
    Assert-Foreground
    $r = [Vdb]::Rect($Ctl.H)
    $x = if ($Dx -ge 0) { $r.L + $Dx } else { [int](($r.L + $r.R) / 2) }
    $y = if ($Dy -ge 0) { $r.T + $Dy } else { [int](($r.T + $r.B) / 2) }
    Wait-Uncovered $x $y
    [Vdb]::Click($x, $y)
    Start-Sleep -Milliseconds $StepDelayMs
}
# --- vietda-bank-import.ps1 dòng 944–983 ---
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
# --- vietda-bank-import.ps1 dòng 1122–1128 ---
function Get-VisibleKids($Root) {
    foreach ($h in [Vdb]::Descendants($Root)) {
        if (-not [Vdb]::IsWindowVisible($h)) { continue }
        $r = [Vdb]::Rect($h)
        [pscustomobject]@{ H = $h; Cls = [Vdb]::ClassOf($h); Text = (([Vdb]::TextOf($h) -replace '&(?=\S)', '').Trim()); L = $r.L; T = $r.T; R = $r.R; B = $r.B; CY = ($r.T + $r.B) / 2 }
    }
}
# --- vietda-bank-import.ps1 dòng 1218–1229 ---
function Set-DateBox($Ctl, [string]$Date, [string]$What) {
    if ($Ctl.Cls -like '*DateTimePick*') {
        Click-Control $Ctl 10
        Send-Keys $Date
    } else {
        $e = if ($Ctl.Cls -like '*EDIT*') { $Ctl.H } else { @([Vdb]::Descendants($Ctl.H) | Where-Object { [Vdb]::ClassOf($_) -eq 'Edit' }) | Select-Object -First 1 }
        if (-not $e) { throw "ô $What ($($Ctl.Cls)) không nhập được" }
        [void](Set-Field ([pscustomobject]@{ H = $e }) $Date { [Vdb]::TextOf($e) -eq $Date })
    }
    $got = [Vdb]::TextOf($Ctl.H)
    if ($got -ne $Date) { throw "không đặt được $What = $Date (đọc lại '$got')" }
}

# ======== Hết phần chép — dưới đây riêng của vietda-sales-check.ps1 ========

$ToolDir = $PSScriptRoot
$LogFile = Join-Path $ToolDir '_vietda-xh-check.log'
$InputDir = Join-Path $ToolDir 'Input'
$OutDir = Join-Path (Join-Path $ToolDir 'Output') ((Get-Date -Format 'yyyy-MM-dd_HHmmss') + '_kiem-xh')
$Inv = [Globalization.CultureInfo]::InvariantCulture
$ReasonOk = 'Doanh thu bán hàng'
$TkCoOk = '33311'
$ListingTitle = 'Bảng kê chứng từ nhập xuất'
$SearchTitle = 'Tìm kiếm chứng từ nhập xuất'
$FormTitle = 'Xuất bán hàng'
$CashReceiptTitle = 'Phiếu thu tiền mặt'   # form mở ra khi bấm "Thu tiền" trên phiếu XH
$ShowRateBox = 'Hiển thị thuế suất từng mặt hàng'
# Cột lưới dòng hàng trên phiếu XH (thứ tự VietDA 09/11/2026): Mã hàng | Tên | ĐVT | SL | Đơn giá | Thành tiền | Tiền hàng | TK Nợ | TK Có |
# %CK | Tiền CK | Nợ CK | Có CK | ĐG vốn | Tiền vốn | Nợ GV | Có GV | Giá đích danh | Tiền VAT | Tổng tiền. ĐVT là ô chọn (F2 không mở) → không đọc.
# Tick "Hiển thị thuế suất từng mặt hàng" → VietDA chèn cột "Loại thuế" sau "Giá đích danh" (thấy 10/11/2026) → Tiền VAT / Tổng tiền lùi 1 cột.
# → đọc cả cột 18, 19, 20 rồi tự nhận: Tiền hàng + c18 = c19 (không có cột Loại thuế) hay Tiền hàng + c19 = c20 (có) — vừa đúng cột,
#   vừa biết ô tick đó (không phụ thuộc Scale màn hình như cách đọc pixel).
# Cột "Số hóa đơn" của dòng hàng (sau Tổng tiền) = cột 20, có cột Loại thuế thì 21 — phiếu kế toán làm đúng ghi Số HĐ ở mọi dòng (13/11/2026)
$GridCols = [ordered]@{ Code = 0; Name = 1; Qty = 3; Price = 4; Goods = 6; TkNo = 7; TkCo = 8; Disc = 10; Cost = 14; NoGv = 15; CoGv = 16; C18 = 18; C19 = 19; C20 = 20; C21 = 21 }
# Quy tắc kế toán (10/11/2026, ĐỔI 14/11/2026): tổng thanh toán (tiền hàng + thuế) phải đúng XML; lệch làm tròn thì CHỈNH TIỀN THUẾ VAT, KHÔNG sửa tiền hàng
# → tiền hàng lệch XML tối đa $RoundAdjMax đ vẫn chỉ Cảnh báo (phiếu cũ chỉnh tay kiểu 10/11); thuế lệch ≤ $RoundAdjMax đ -Fix sửa.
# 14/11/2026 user: tiền hàng ĐÃ khớp XML mà tổng lệch 1 đ (VietDA cộng thuế từng dòng) → -Fix sửa ô "Tiền thuế" đầu phiếu = thuế XML (Get-HeaderFixes)
$RoundAdjMax = 10
# Click vào lưới dòng hàng (client, pixel logic — tool + VietDA đều DPI-unaware nên Scale 125% không đổi số này): cột tiêu đề dòng,
# dòng 1. Lệch (Scale / font khác) thì trúng ô góc tiêu đề — vô hại; sau click tool ←/↑ về ô đầu dòng 1 nên không phụ thuộc chỗ click.
# Lưới danh sách KHÔNG click (lệch lên tiêu đề "Ngày CT" = sắp xếp lại danh sách): F5 (VietDA nạp lại, về dòng 1) rồi ↓.
$FormRow1 = @{ X = 18; Y = 45 }
function Parse-Num([string]$s) {
    if ($null -eq $s) { return $null }
    $s = $s.Trim()
    if (-not $s -or $s -eq '-') { return $null }
    $d = 0.0
    if ([double]::TryParse($s, [Globalization.NumberStyles]::Float, $Inv, [ref]$d)) { return $d }
    return $null
}
function Round-Money($x) { if ($null -eq $x) { return 0L }; [long][Math]::Round([double]$x, 0, [MidpointRounding]::AwayFromZero) }
function Norm-Unit([string]$s) { (Normalize-Name $s) -replace ' ', '' }
function Fmt-Date([datetime]$d) { $d.ToString('dd/MM/yyyy') }

# ---------- XML bán ra ----------
function Find-SaleXmlFolder {
    if ($XmlFolder) {
        if (-not (Test-Path -LiteralPath $XmlFolder -PathType Container)) { Fail "Không có thư mục -XmlFolder $XmlFolder" }
        return $XmlFolder
    }
    $cands = @((Join-Path $ToolDir 'xml'), (Join-Path $InputDir 'xml'))
    $found = @($cands | Where-Object { (Test-Path -LiteralPath $_ -PathType Container) -and @(Get-ChildItem -LiteralPath $_ -Filter *.xml -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).Count })
    if (-not $found.Count) {
        $open = @($cands | Where-Object { Test-Path -LiteralPath $_ -PathType Container }) + @($ToolDir)
        if (-not $NoOpen) { Start-Process explorer.exe $open[0] }
        Fail "Chưa có XML hóa đơn trong $($cands -join ' / ') — bỏ XML bán ra (nên dùng XML QUY ĐỔI) vào xml\sold cạnh tool rồi chạy lại."
    }
    if ($found.Count -gt 1) { Write-Log WARN "Cả $($found -join ' và ') đều có XML — chỉ dùng $($found[0])" }
    $sold = Join-Path $found[0] 'sold'
    if (Test-Path -LiteralPath $sold -PathType Container) { return $sold }
    Write-Log WARN "Không có thư mục $sold — quét mọi XML trong $($found[0]) (tự lọc HĐ bán ra theo MST công ty)"
    return $found[0]
}

function Read-SaleXml([string]$Folder) {
    $all = [System.Collections.Generic.List[object]]::new()
    $bad = 0
    foreach ($f in Get-ChildItem -LiteralPath $Folder -Filter *.xml -File -Recurse | Where-Object { $_.Extension -eq '.xml' }) {
        try {
            $raw = [IO.File]::ReadAllText($f.FullName, [Text.Encoding]::UTF8)
            $xml = New-Object Xml.XmlDocument
            $xml.LoadXml($raw)
            $pick = { param($node, $xp) $n = $node.SelectSingleNode($xp); if ($n) { $n.InnerText.Trim() } else { '' } }
            $so = & $pick $xml "//*[local-name()='TTChung']/*[local-name()='SHDon']"
            $num = 0L
            if (-not [long]::TryParse($so, [ref]$num)) { continue }
            $nlap = & $pick $xml "//*[local-name()='TTChung']/*[local-name()='NLap']"
            $date = [datetime]::MinValue
            if (-not [datetime]::TryParseExact($nlap.Substring(0, [Math]::Min(10, $nlap.Length)), 'yyyy-MM-dd', $Inv, 'None', [ref]$date)) { Write-Log WARN "XML $($f.Name): NLap '$nlap' lạ — bỏ qua"; $bad++; continue }
            $lines = [System.Collections.Generic.List[object]]::new()
            foreach ($h in $xml.SelectNodes("//*[local-name()='DSHHDVu']/*[local-name()='HHDVu']")) {
                $tsuat = & $pick $h "*[local-name()='TSuat']"
                $rate = $null
                if ($tsuat -match '^\s*(\d+(?:[.,]\d+)?)\s*%?\s*$') { $rate = [double]::Parse(($Matches[1] -replace ',', '.'), $Inv) }
                elseif ($tsuat -match '(?i)^(KCT|KKKNT)') { $rate = 0.0 }
                $tchat = & $pick $h "*[local-name()='TChat']"
                $lines.Add([pscustomobject]@{
                    TChat = $(if ($tchat) { $tchat } else { '1' })
                    Stt = & $pick $h "*[local-name()='STT']"
                    Code = & $pick $h "*[local-name()='MHHDVu']"
                    Name = & $pick $h "*[local-name()='THHDVu']"
                    Unit = & $pick $h "*[local-name()='DVTinh']"
                    Qty = Parse-Num (& $pick $h "*[local-name()='SLuong']")
                    Price = Parse-Num (& $pick $h "*[local-name()='DGia']")
                    Goods = Round-Money (Parse-Num (& $pick $h "*[local-name()='ThTien']"))
                    RateText = $tsuat
                    Rate = $rate
                })
            }
            $all.Add([pscustomobject]@{
                Number = $num
                Symbol = (& $pick $xml "//*[local-name()='TTChung']/*[local-name()='KHMSHDon']") + (& $pick $xml "//*[local-name()='TTChung']/*[local-name()='KHHDon']")
                Kh = & $pick $xml "//*[local-name()='TTChung']/*[local-name()='KHHDon']"
                Date = $date.Date
                Pay = & $pick $xml "//*[local-name()='TTChung']/*[local-name()='HTTToan']"
                SellerMst = & $pick $xml "//*[local-name()='NBan']/*[local-name()='MST']"
                BuyerMst = & $pick $xml "//*[local-name()='NMua']/*[local-name()='MST']"
                BuyerName = $(
                    $bn = & $pick $xml "//*[local-name()='NMua']/*[local-name()='Ten']"
                    if ($bn) { $bn } else { & $pick $xml "//*[local-name()='NMua']/*[local-name()='HVTNMHang']" })
                Goods = Round-Money (Parse-Num (& $pick $xml "//*[local-name()='TToan']/*[local-name()='TgTCThue']"))
                Vat = Round-Money (Parse-Num (& $pick $xml "//*[local-name()='TToan']/*[local-name()='TgTThue']"))
                Discount = Round-Money (Parse-Num (& $pick $xml "//*[local-name()='TToan']/*[local-name()='TTCKTMai']"))
                Total = Parse-Num (& $pick $xml "//*[local-name()='TToan']/*[local-name()='TgTTTBSo']")
                Converted = $raw.Contains('Bản QUY ĐỔI ĐVT')
                Lines = $lines
                File = $f.Name
            })
        } catch {
            $bad++
            Write-Log WARN "Bỏ qua XML lỗi $($f.Name): $($_.Exception.Message)"
        }
    }
    if (-not $all.Count) { Fail "Thư mục $Folder không có XML hóa đơn đọc được$(if ($bad) { " ($bad file lỗi)" })" }
    # công ty = MST người bán xuất hiện nhiều nhất → chỉ giữ HĐ bán ra
    $company = ($all | Group-Object SellerMst | Sort-Object Count -Descending | Select-Object -First 1).Name
    $sold = @($all | Where-Object { $_.SellerMst -eq $company })
    if ($sold.Count -lt $all.Count) { Write-Log INFO "Bỏ $($all.Count - $sold.Count) XML mua vào (người bán ≠ MST công ty $company)" }
    # trùng Ký hiệu + Số (cả XML gốc lẫn XML quy đổi) → ưu tiên bản quy đổi
    $uniq = [System.Collections.Generic.List[object]]::new()
    foreach ($g in ($sold | Group-Object { "$($_.Symbol)|$($_.Number)" })) {
        $pick1 = @($g.Group | Sort-Object @{ e = { -not $_.Converted } }, File)[0]
        if ($g.Count -gt 1) { Write-Log WARN "HĐ $($g.Name) có $($g.Count) file XML → dùng $($pick1.File)$(if ($pick1.Converted) { ' (bản quy đổi)' })" }
        $uniq.Add($pick1)
    }
    $conv = @($uniq | Where-Object Converted).Count
    Write-Log INFO "XML bán ra: $($uniq.Count) HĐ (MST $company), $conv bản quy đổi, $($uniq.Count - $conv) bản gốc$(if ($bad) { ", $bad file lỗi" })"
    if ($conv -lt $uniq.Count) { Write-Log WARN "$($uniq.Count - $conv) HĐ là XML GỐC (chưa quy đổi) → chỉ so tiền / thuế; SL, ĐVT, mã hàng không so được. Nên dùng XML quy đổi (đúng bản đã Hội nhập VietDA)." }
    return , $uniq
}

# ---------- Danh mục Vật tư hàng hóa (VietDA > Hệ thống > Cập nhật danh mục > Vật tư, hàng hóa > Excel) ----------
function Read-Catalog {
    $files = @()
    if ($Catalog) { $files = @($Catalog) }
    else {
        # Input\danh-muc-vthh\ trước (10/11/2026): .xlsx lạ để thẳng trong Input\ bị tool sao kê coi là sao kê TPBank
        foreach ($d in @((Join-Path $InputDir 'danh-muc-vthh'), $InputDir)) {
            if (Test-Path -LiteralPath $d) { $files += @(Get-ChildItem -LiteralPath $d -File -Filter *.xlsx | Where-Object { $_.Name -notlike '~$*' } | Sort-Object LastWriteTime -Descending | ForEach-Object { $_.FullName }) }
        }
    }
    foreach ($f in $files) {
        try { $rows = Read-XlsxRows $f } catch { Write-Log WARN "Đọc $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)"; continue }
        $hdr = -1; $col = @{}
        for ($i = 0; $i -lt [Math]::Min(15, $rows.Count) -and $hdr -lt 0; $i++) {
            foreach ($k in @($rows[$i].Keys)) {
                switch (Normalize-Name ([string]$rows[$i][$k])) {
                    'MA HANG' { $col.Code = $k; $hdr = $i }
                    'TEN HANG HOA VAT TU' { $col.Name = $k }
                    'DVT' { $col.Unit = $k }
                }
            }
        }
        if ($hdr -lt 0 -or -not $col.Name) { continue }
        $title = @($rows | Select-Object -First $hdr | ForEach-Object { $_.Values } | Where-Object { (Normalize-Name ([string]$_)) -like 'DANH MUC VAT TU*' })
        if (-not $title.Count -and -not $Catalog) { continue }
        $byCode = @{}; $byName = @{}
        for ($i = $hdr + 1; $i -lt $rows.Count; $i++) {
            $code = ([string]$rows[$i][$col.Code]).Trim()
            $name = ([string]$rows[$i][$col.Name]).Trim()
            if (-not $code -or $name.Length -le 1) { continue }
            $item = [pscustomobject]@{ Code = $code; Name = $name; Unit = $(if ($col.Unit) { ([string]$rows[$i][$col.Unit]).Trim() } else { '' }) }
            $byCode[$code.ToUpperInvariant()] = $item
            $nk = Normalize-Name $name
            if (-not $byName.ContainsKey($nk)) { $byName[$nk] = [System.Collections.Generic.List[object]]::new() }
            $byName[$nk].Add($item)
        }
        Write-Log INFO "Danh mục Vật tư hàng hóa: $(Split-Path $f -Leaf) — $($byCode.Count) mã"
        if ((Split-Path $f -Parent) -eq $InputDir) { Write-Log WARN "Danh mục đang nằm thẳng trong Input\ → tool sao kê sẽ coi là sao kê TPBank. Chuyển file vào Input\danh-muc-vthh\ (VietDA-Tools.bat làm sẵn)." }
        return [pscustomobject]@{ File = (Split-Path $f -Leaf); ByCode = $byCode; ByName = $byName }
    }
    Write-Log WARN "Không có danh mục Vật tư hàng hóa (.xlsx có 'DANH MỤC VẬT TƯ - HÀNG HÓA') trong $InputDir\danh-muc-vthh → KHÔNG kiểm mã / tên theo danh mục (VietDA: Hệ thống > Cập nhật danh mục > Vật tư, hàng hóa > Excel)"
    return $null
}

# ---------- VietDA: mở danh sách chứng từ XH (Nhập xuất > Tìm kiếm chứng từ) ----------
function Find-Vietda {
    foreach ($p in Get-Process -Name Menu, Main -ErrorAction SilentlyContinue) {
        foreach ($top in [Vdb]::Tops($p.Id)) {
            if ([Vdb]::ClassOf($top) -notlike '*Window.8*') { continue }
            if (-not ([Vdb]::Descendants($top) | Where-Object { [Vdb]::ClassOf($_) -like '*MDICLIENT*' })) { continue }
            return [pscustomobject]@{ Pid = $p.Id; Main = $top }
        }
    }
    return $null
}
function Find-Listings { @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::IsWindowVisible($_) -and [Vdb]::TextOf($_) -eq $ListingTitle }) }
function Find-SearchDialog {
    $cands = @([Vdb]::Tops($script:vda.Pid)) + @([Vdb]::Descendants($script:vda.Main))
    @($cands | Where-Object { [Vdb]::IsWindowVisible($_) -and [Vdb]::TextOf($_) -like "$SearchTitle*" }) | Select-Object -First 1
}
function Close-SearchDialog {
    $dlg = Find-SearchDialog
    if (-not $dlg) { return }
    $quit = @(Get-VisibleKids $dlg | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Thoát*' }) | Select-Object -First 1
    if ($quit) { [Vdb]::ClickButton($quit.H) } else { [Vdb]::Press($dlg, 2) }
    $wait = (Get-Date).AddSeconds(3)
    while ((Find-SearchDialog) -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    if (Find-SearchDialog) { Write-Log WARN 'không đóng được hộp Tìm kiếm chứng từ — bấm Thoát (ESC) trên VietDA' } else { Write-Log INFO 'Đã đóng hộp Tìm kiếm chứng từ.' }
}
function Close-Listings {
    foreach ($old in Find-Listings) {
        $quit = @(Get-VisibleKids $old | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Thoát' }) | Select-Object -First 1
        if ($quit) { [Vdb]::ClickButton($quit.H) }
    }
    $wait = (Get-Date).AddSeconds(5)
    while ((Find-Listings).Count -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    return -not (Find-Listings).Count
}

# Menu VietDA tự vẽ → OCR thanh menu tìm "Nhập xuất" (mục đầu tiên), click, OCR menu xổ tìm mục $Want
function Click-NhapXuatItem([string]$Want, [string]$What) {
    if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
    $kids = @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::GetParent($_) -eq $script:vda.Main -and [Vdb]::IsWindowVisible($_) } |
        ForEach-Object { $r = [Vdb]::Rect($_); [pscustomobject]@{ H = $_; L = $r.L; T = $r.T; W = $r.R - $r.L; Ht = $r.B - $r.T; Name = [Vdb]::TextOf($_) } })
    $bar = @($kids | Where-Object { $_.Name -eq 'mainMenu' -and $_.Ht -gt 0 }) | Select-Object -First 1
    if (-not $bar) { $bar = @($kids | Where-Object { $_.Ht -ge 15 -and $_.Ht -le 40 } | Sort-Object T) | Select-Object -First 1 }
    if (-not $bar) { throw 'không thấy thanh menu VietDA' }
    $line = @(Ocr-Screen $bar.L $bar.T ([Math]::Min($bar.W, 900)) $bar.Ht 3)
    $words = @($line | ForEach-Object { $_.Words } | Sort-Object X)
    $hit = $null
    for ($i = 0; $i -lt $words.Count -and -not $hit; $i++) {
        if ($words[$i].Text -match '(?i)^Nh\S{0,3}p-?xu') { $hit = $words[$i] }
        elseif ($i -lt $words.Count - 1 -and $words[$i].Text -match '(?i)^Nh\S{0,3}p$' -and $words[$i + 1].Text -match '(?i)^xu') { $hit = $words[$i] }
    }
    # "Nhập xuất" luôn là mục đầu thanh menu: OCR đọc méo nhưng chữ đầu bắt đầu bằng N → lấy chữ đó
    if (-not $hit -and $words.Count -and $words[0].Text -match '(?i)^N') { $hit = $words[0]; Write-Log WARN "OCR đọc 'Nhập xuất' thành '$($words[0].Text)' — lấy mục đầu thanh menu" }
    if (-not $hit) { throw "OCR không thấy menu 'Nhập xuất' (đọc được: '$(($line | ForEach-Object { $_.Text }) -join ' / ')'; thanh menu $($bar.L),$($bar.T) $($bar.W)x$($bar.Ht), Scale màn hình $([Math]::Round($script:screenScale * 100))%)" }
    Write-Log INFO "Menu 'Nhập xuất' ở $($hit.X),$($hit.Y)"
    $drop = $null
    for ($attempt = 1; $attempt -le 2 -and -not $drop; $attempt++) {
        if ($attempt -gt 1) {
            Write-Log WARN "menu 'Nhập xuất' không xổ xuống — thử lại"
            [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
            Start-Sleep -Milliseconds 700
            if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
        }
        $before = @{}
        foreach ($t0 in [Vdb]::Tops($script:vda.Pid)) { $before[$t0.ToInt64()] = $true }
        Assert-Foreground
        [Vdb]::Click($hit.X, $hit.Y)
        $wait = (Get-Date).AddSeconds(3)
        while (-not $drop -and (Get-Date) -lt $wait) {
            Start-Sleep -Milliseconds 200
            $drop = @([Vdb]::Tops($script:vda.Pid) | Where-Object { -not $before.ContainsKey($_.ToInt64()) -and [Vdb]::ClassOf($_) -notlike '*Shadow*' -and [Vdb]::ClassOf($_) -ne '#32770' } |
                Where-Object { $rc = [Vdb]::Rect($_); ($rc.R - $rc.L) -gt 40 -and ($rc.B - $rc.T) -gt 40 }) | Select-Object -First 1
        }
    }
    if (-not $drop) { throw "bấm 'Nhập xuất' nhưng menu không xổ xuống" }
    Start-Sleep -Milliseconds 300
    $r = [Vdb]::Rect($drop)
    $items = @(Ocr-Screen $r.L $r.T ($r.R - $r.L) ($r.B - $r.T) 3)
    $item = @($items | Where-Object { $_.Text -match $Want }) | Select-Object -First 1
    if (-not $item) {
        [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        throw "OCR không thấy mục $What trong menu Nhập xuất (đọc được: $(($items | ForEach-Object { $_.Text }) -join ' / '))"
    }
    Assert-Foreground
    [Vdb]::Click($item.X, $item.Y)
}

# Nhập xuất > Tìm kiếm chứng từ: Ngày từ/đến + Loại XH (xóa lọc khác VietDA còn nhớ) > Hiển thị → hwnd bảng kê
function Open-XhListing([string]$FromD, [string]$ToD) {
    Close-SearchDialog
    if (-not (Close-Listings)) { throw "không đóng được '$ListingTitle' đang mở (bấm Thoát trên bảng kê rồi chạy lại)" }
    Click-NhapXuatItem '(?i)^T\S{0,3}\s+ki\S{0,3}\s+ch' 'Tìm kiếm chứng từ'
    $dlg = $null
    $wait = (Get-Date).AddSeconds(10)
    while (-not $dlg -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 300; $dlg = Find-SearchDialog }
    if (-not $dlg) { throw "bấm 'Tìm kiếm chứng từ' nhưng không thấy hộp '$SearchTitle'" }
    Start-Sleep -Milliseconds 500
    $script:extraFg = $dlg
    try {
        if (-not [Vdb]::Activate($dlg)) { throw 'không đưa được hộp Tìm kiếm lên trước' }
        $kids = @(Get-VisibleKids $dlg)
        $label = { param($t) @($kids | Where-Object { $_.Cls -notlike '*EDIT*' -and $_.Cls -notlike '*COMBOBOX*' -and ($_.Text -replace '\s*:\s*$', '') -eq $t }) | Select-Object -First 1 }
        $rightOf = {
            param($ref)
            if (-not $ref) { return $null }
            @($kids | Where-Object { $_.Cls -notmatch 'STATIC|BUTTON' -and $_.H -ne $ref.H -and $_.L -ge $ref.R - 8 -and [Math]::Abs($_.CY - $ref.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
        }
        $c = @{
            From = & $rightOf (@((& $label 'Ngày chứng từ'), (& $label 'Ngày chứng từ từ')) | Where-Object { $_ } | Select-Object -First 1)
            To = & $rightOf (& $label 'Đến ngày')
            Type = & $rightOf (& $label 'Loại chứng từ')
            Show = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Hiển thị' }) | Select-Object -First 1
        }
        $miss = @('From', 'To', 'Type', 'Show' | Where-Object { -not $c[$_] })
        if ($miss.Count) {
            Write-Log WARN "Control hộp Tìm kiếm: $(($kids | ForEach-Object { "$($_.Cls -replace '^WindowsForms10\.|\.app\..*$', '')'$($_.Text)'@$($_.L),$($_.T)" }) -join ' ; ')"
            throw "không nhận ra control trên hộp Tìm kiếm: $($miss -join ', ') (VietDA đổi giao diện?)"
        }
        $cleared = [System.Collections.Generic.List[string]]::new()
        foreach ($k in $kids) {
            if ($k.H -eq $c.Type.H -or [Vdb]::GetParent($k.H) -eq $c.Type.H) { continue }
            $now = [Vdb]::TextOf($k.H)
            if (-not $now) { continue }
            if ($k.Cls -like '*COMBOBOX*') { [Vdb]::SelectCombo($k.H, -1); $cleared.Add($now) }
            elseif ($k.Cls -like '*EDIT*') { [void][Vdb]::SetText($k.H, ''); $cleared.Add($now) }
        }
        if ($cleared.Count) { Write-Log INFO "Xóa lọc VietDA còn nhớ: $(($cleared | Select-Object -Unique) -join ', ')" }
        Set-DateBox $c.From $FromD 'Ngày chứng từ từ'
        Set-DateBox $c.To $ToD 'Đến ngày'
        $items = @([Vdb]::ComboItems($c.Type.H))
        $idx = -1
        for ($i = 0; $i -lt $items.Count -and $idx -lt 0; $i++) { if ($items[$i] -match '^XH\b') { $idx = $i } }
        if ($idx -ge 0) { [Vdb]::SelectCombo($c.Type.H, $idx) }
        else {
            $e = @([Vdb]::Descendants($c.Type.H) | Where-Object { [Vdb]::ClassOf($_) -eq 'Edit' }) | Select-Object -First 1
            if (-not $e) { throw "ô Loại chứng từ không có 'XH' (có: $($items -join ', '))" }
            [void](Set-Field ([pscustomobject]@{ H = $e }) 'XH' { [Vdb]::TextOf($e) -eq 'XH' })
        }
        if ([Vdb]::TextOf($c.Type.H) -notmatch '^XH') { throw "không chọn được Loại chứng từ XH (đọc lại '$([Vdb]::TextOf($c.Type.H))')" }
        Write-Log INFO "Tìm kiếm chứng từ XH từ $FromD đến $ToD > Hiển thị"
        $res = Invoke-Button $c.Show 'Hiển thị'
        if ($res.Status -ne 'OK') { throw $res.Message }
    } catch { Close-SearchDialog; throw } finally { $script:extraFg = [IntPtr]::Zero }
    $listing = $null
    $wait = (Get-Date).AddSeconds(120)
    while (-not $listing -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 300; $listing = @(Find-Listings) | Select-Object -First 1 }
    Close-SearchDialog
    if (-not $listing) { throw "VietDA không ra '$ListingTitle'$(if ($res.Message) { " — $($res.Message)" })" }
    return $listing
}

# ---------- VietDA: đọc từng phiếu (chọn dòng > Sửa phiếu > đọc > Thoát) — gửi message thẳng vào control, không cần chuột/foreground ----------
if (-not ('VdForm' -as [type])) {
    Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;
public static class VdForm {
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    // VietDA thu nhỏ → lưới cỡ 0, PrintWindow ra ảnh rỗng: khôi phục KHÔNG lấy focus (SW_SHOWNOACTIVATE)
    public static bool RestoreNoActivate(IntPtr h) { if (!IsIconic(h)) return false; ShowWindow(h, 4); return true; }
    static IntPtr XY(int x, int y) { return (IntPtr)((y << 16) | (x & 0xFFFF)); }
    // gửi đồng bộ, tối đa 5 giây (VietDA bật hộp thoại giữa chừng → không treo tool)
    public static bool Send(IntPtr h, uint m, IntPtr w, IntPtr l) { IntPtr r; return SendMessageTimeout(h, m, w, l, 2, 5000, out r) != IntPtr.Zero; }
    public static bool Key(IntPtr h, int vk) { return Send(h, 0x100, (IntPtr)vk, IntPtr.Zero) & Send(h, 0x101, (IntPtr)vk, IntPtr.Zero); }
    public static void PostKey(IntPtr h, int vk) { PostMessage(h, 0x100, (IntPtr)vk, IntPtr.Zero); PostMessage(h, 0x101, (IntPtr)vk, IntPtr.Zero); }
    public static bool Click(IntPtr h, int x, int y) { return Send(h, 0x201, (IntPtr)1, XY(x, y)) & Send(h, 0x202, IntPtr.Zero, XY(x, y)); }
    public static void PostClick(IntPtr h, int x, int y) { PostMessage(h, 0x201, (IntPtr)1, XY(x, y)); PostMessage(h, 0x202, IntPtr.Zero, XY(x, y)); }
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
    [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetFocus();
    // focus THẬT cho 1 ô mà không đưa VietDA lên trước (ô chọn Lý do chỉ nhận chữ khi đã có focus → Enter/Leave của WinForms chạy);
    // trả về ô đang focus (VietDA tạo lại combo khi nhận focus → handle mới)
    public static IntPtr FocusNoActivate(IntPtr h) {
        uint t = GetWindowThreadProcessId(h, IntPtr.Zero), me = GetCurrentThreadId();
        bool at = AttachThreadInput(me, t, true);
        try { SetFocus(h); System.Threading.Thread.Sleep(200); return GetFocus(); }
        finally { if (at) AttachThreadInput(me, t, false); }
    }
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("kernel32.dll")] static extern IntPtr VirtualAllocEx(IntPtr hp, IntPtr addr, UIntPtr size, uint type, uint protect);
    [DllImport("kernel32.dll")] static extern bool VirtualFreeEx(IntPtr hp, IntPtr addr, UIntPtr size, uint type);
    [DllImport("kernel32.dll")] static extern bool ReadProcessMemory(IntPtr hp, IntPtr addr, byte[] buf, UIntPtr size, out UIntPtr read);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
    // Bấm tab thứ $index của SysTabControl32 (tab phiếu trên VietDA) bằng message — không chuột / foreground.
    // TCM_GETITEMRECT trả RECT vào bộ nhớ của tiến trình VietDA → cấp vùng nhớ ở đó rồi đọc về.
    public static bool ClickTab(IntPtr tab, int index) {
        uint pid; GetWindowThreadProcessId(tab, out pid);
        IntPtr hp = OpenProcess(0x0008 | 0x0010 | 0x0020, false, pid);
        if (hp == IntPtr.Zero) return false;
        try {
            IntPtr mem = VirtualAllocEx(hp, IntPtr.Zero, (UIntPtr)16, 0x3000, 0x04);
            if (mem == IntPtr.Zero) return false;
            try {
                if (!Send(tab, 0x130A, (IntPtr)index, mem)) return false;
                byte[] b = new byte[16]; UIntPtr n;
                if (!ReadProcessMemory(hp, mem, b, (UIntPtr)16, out n)) return false;
                int l = BitConverter.ToInt32(b, 0), t = BitConverter.ToInt32(b, 4), r = BitConverter.ToInt32(b, 8), btm = BitConverter.ToInt32(b, 12);
                if (r <= l || btm <= t) return false;
                PostClick(tab, (l + r) / 2, (t + btm) / 2);
                return true;
            } finally { VirtualFreeEx(hp, mem, UIntPtr.Zero, 0x8000); }
        } finally { CloseHandle(hp); }
    }
    // chụp cửa sổ kể cả khi bị app khác che (PW_RENDERFULLCONTENT)
    public static Bitmap Snap(IntPtr h, int w, int ht) {
        Bitmap b = new Bitmap(Math.Max(1, w), Math.Max(1, ht));
        using (Graphics g = Graphics.FromImage(b)) { IntPtr dc = g.GetHdc(); try { PrintWindow(h, dc, 2); } finally { g.ReleaseHdc(dc); } }
        return b;
    }
    static int Lum(Color c) { return (c.R + c.G + c.B) / 3; }
    // Ô tick = hình vuông viền đen (13px ở 100%, đo 10/11/2026). Dò quanh (bx,by) ±6px, cạnh 13×s (±1): viền ≥80% điểm tối → có ô;
    // trong ô (bỏ viền 2×s px) ≥3 điểm tối → đã tick. 1 = tick, 0 = trống, -1 = không thấy ô (ảnh lệch tỉ lệ / bị che…)
    public static int Tick(Bitmap b, int bx, int by, int bh, double s) {
        int n0 = (int)Math.Round(13 * s), m = (int)Math.Ceiling(2 * s);
        for (int r = 0; r <= 6; r++)
            for (int dy = -r; dy <= r; dy++)
                for (int dx = -r; dx <= r; dx++) {
                    if (Math.Max(Math.Abs(dx), Math.Abs(dy)) != r) continue;
                    for (int dn = 0; dn <= 2; dn++) {
                        int n = n0 + (dn == 0 ? 0 : dn == 1 ? -1 : 1);   // ảnh co giãn → cạnh lệch ±1px
                        int x0 = bx + dx, y0 = by + (bh - n) / 2 + dy;
                        if (x0 < 0 || y0 < 0 || x0 + n > b.Width || y0 + n > b.Height || n < 9) continue;
                        int edge = 0;
                        for (int i = 0; i < n; i++) {
                            if (Lum(b.GetPixel(x0 + i, y0)) < 140) edge++;
                            if (Lum(b.GetPixel(x0 + i, y0 + n - 1)) < 140) edge++;
                            if (Lum(b.GetPixel(x0, y0 + i)) < 140) edge++;
                            if (Lum(b.GetPixel(x0 + n - 1, y0 + i)) < 140) edge++;
                        }
                        if (edge < 4 * n * 0.8) continue;
                        int dark = 0, area = 0;
                        for (int x = x0 + m; x < x0 + n - m; x++)
                            for (int y = y0 + m; y < y0 + n - m; y++) { area++; if (Lum(b.GetPixel(x, y)) < 140) dark++; }
                        if (area == 0 || dark > area * 0.6) continue;
                        return dark >= 3 ? 1 : 0;
                    }
                }
        return -1;
    }
}
"@
}

function Parse-Vn([string]$s) {
    if ($null -eq $s) { return $null }
    $t = $s.Trim()
    if (-not $t) { return $null }
    Parse-Num (($t -replace '\.', '') -replace ',', '.')
}
function Restore-Vietda {
    if ([VdForm]::RestoreNoActivate($script:vda.Main)) { Write-Log INFO 'VietDA đang thu nhỏ → khôi phục (không lấy focus)'; Start-Sleep -Milliseconds 800; Wait-Idle $script:vda.Main }
}
function Get-Forms { @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::TextOf($_) -eq $FormTitle }) }
function Wait-Idle([IntPtr]$H, [int]$Sec = 30) {
    $w = (Get-Date).AddSeconds($Sec)
    while (-not [Vdb]::IsIdle($H) -and (Get-Date) -lt $w) { Start-Sleep -Milliseconds 100 }
}

# Hộp thoại 1 nút → ghi lại + OK; câu hỏi nhiều nút → dừng (để nguyên cho người dùng)
function Take-Dialog([string]$When) {
    $d = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
    if (-not $d) { return $null }
    $text = [Vdb]::MessageText($d); $title = [Vdb]::TextOf($d)
    if ($null -eq $text -or [Vdb]::ButtonCount($d) -gt 1) { throw "VietDA hỏi khi $When — [$title] $text (để nguyên cho người dùng xử lý)" }
    [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 }))
    Start-Sleep -Milliseconds 400
    Write-Log WARN "VietDA báo khi $When`: [$title] $text → bấm OK"
    return "[$title] $text"
}

function Get-ListingParts($Listing) {
    $kids = @(Get-VisibleKids $Listing)
    $grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and -not $_.Text } | Sort-Object { ($_.B - $_.T) } -Descending) | Select-Object -First 1
    $edit = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Sửa phiếu' }) | Select-Object -First 1
    if (-not $grid -or -not $edit) { throw "không nhận ra lưới chứng từ / nút 'Sửa phiếu' trên '$ListingTitle' (VietDA đổi giao diện?)" }
    [pscustomobject]@{ Grid = $grid.H; Edit = $edit.H }
}

# Chọn dòng rồi Sửa phiếu. -Next: ↓ 1 lần từ dòng đang chọn (sau Thoát lưới vẫn giữ dòng — nhanh);
# không -Next: F5 (VietDA nạp lại danh sách, về dòng 1 — không click: lệch Scale thì trúng tiêu đề cột = sắp xếp lại) rồi ↓ $Index lần
# (lưới tự cuộn; mỗi ↓ ~0,2 giây → chỉ dùng cho dòng đầu / kiểm lại). Message gửi theo thứ tự (PostMessage) → 'Sửa phiếu' chạy sau cùng.
function Open-ListingRow($L, [int]$Index, [switch]$Next, [switch]$Same) {
    $known = @{}
    foreach ($f in Get-Forms) { $known[$f.ToInt64()] = $true }
    if ($Same) { }
    elseif ($Next) { [VdForm]::PostKey($L.Grid, 0x28) }
    else {
        [VdForm]::PostKey($L.Grid, 0x74)
        Start-Sleep -Milliseconds 300; Wait-Idle $L.Grid; Start-Sleep -Milliseconds 500; Wait-Idle $L.Grid
        for ($k = 0; $k -lt $Index; $k++) { [VdForm]::PostKey($L.Grid, 0x28) }
    }
    [Vdb]::ClickButton($L.Edit)
    $deadline = (Get-Date).AddSeconds($FormTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 150
        if ([Vdb]::Dialogs($script:vda.Pid).Count) { return [pscustomobject]@{ Form = $null; Note = (Take-Dialog "mở dòng $($Index + 1)") } }
        $new = @(Get-Forms | Where-Object { -not $known.ContainsKey($_.ToInt64()) -and [Vdb]::IsWindowVisible($_) }) | Select-Object -First 1
        if ($new) { return [pscustomobject]@{ Form = $new; Note = '' } }
    }
    throw "bấm 'Sửa phiếu' (dòng $($Index + 1)) quá $FormTimeoutSec giây không thấy phiếu mở"
}

# Ô tick (owner-draw: BM_GETCHECK luôn 0, UIA tắt): chụp phiếu bằng PrintWindow (kể cả bị che), dò ô vuông viền đen bên trái nút.
# Tọa độ tool → pixel ảnh: tool + VietDA đều DPI-unaware → 1:1; phòng máy khác co giãn ảnh theo Scale màn hình → thử thêm hệ số đó.
# $true / $false; $null = không thấy ô (ghi chú "kiểm tay", không đoán)
function Test-Ticked($Bmp, $FormRect, $Box) {
    foreach ($s in @(1.0, $script:screenScale) | Select-Object -Unique) {
        $r = [VdForm]::Tick($Bmp, [int][Math]::Round(($Box.L - $FormRect.L) * $s), [int][Math]::Round(($Box.T - $FormRect.T) * $s), [int][Math]::Round(($Box.B - $Box.T) * $s), [double]$s)
        if ($r -ge 0) { return $r -eq 1 }
    }
    return $null
}

# Lưới dòng hàng: vào dòng 1 cột đầu → mỗi cột cần đọc: F2 (mở ô sửa = TextBox) → WM_GETTEXT → Esc vào chính ô sửa (không lưu); → sang cột kế.
# Hết dòng: ← về cột đầu, ↓. Dòng có Mã hàng trống = dòng mới (*) → hết. Không dùng tọa độ ô → không phụ thuộc Scale / độ rộng cột.
# Trả về { Lines; RateCol }: RateCol = lưới có cột "Loại thuế" (= đã tick "Hiển thị thuế suất từng mặt hàng"), $null = không xác định được.
function Read-FormGrid([IntPtr]$Grid) {
    $editor = { @([Vdb]::Descendants($Grid) | Where-Object { [Vdb]::ClassOf($_) -clike 'WindowsForms10.EDIT*' -and [Vdb]::IsWindowVisible($_) }) | Select-Object -First 1 }
    $lastCol = ($GridCols.Values | Measure-Object -Maximum).Maximum
    $want = @{}; foreach ($k in $GridCols.Keys) { $want[$GridCols[$k]] = $k }
    $raw = [System.Collections.Generic.List[object]]::new()
    [void][VdForm]::Click($Grid, $FormRow1.X, $FormRow1.Y)
    # click lệch (Scale/font khác) → vẫn về ô đầu dòng 1
    for ($k = 0; $k -le $lastCol; $k++) { [void][VdForm]::Key($Grid, 0x25) }
    for ($k = 0; $k -lt 3; $k++) { [void][VdForm]::Key($Grid, 0x26) }
    for ($row = 0; $row -lt 500; $row++) {
        $cell = @{}
        for ($c = 0; $c -le $lastCol; $c++) {
            if ($want.ContainsKey($c)) {
                [void][VdForm]::Key($Grid, 0x71)
                $e = & $editor
                if ($e) { $cell[$want[$c]] = [Vdb]::TextOf($e); [void][VdForm]::Key($e, 0x1B) } else { $cell[$want[$c]] = $null }
            }
            if ($c -lt $lastCol) { [void][VdForm]::Key($Grid, 0x27) }
        }
        for ($c = 0; $c -lt $lastCol; $c++) { [void][VdForm]::Key($Grid, 0x25) }
        if (-not ([string]$cell.Code).Trim()) { break }
        $raw.Add($cell)
        [void][VdForm]::Key($Grid, 0x28)
    }
    $e = & $editor; if ($e) { [void][VdForm]::Key($e, 0x1B) }
    # có cột Loại thuế? đếm dòng có tiền: Tiền hàng + c18 = c19 (không) / Tiền hàng + c19 = c20 (có)
    $no = 0; $yes = 0
    foreach ($c in $raw) {
        $g = Round-Money (Parse-Vn $c.Goods); if (-not $g) { continue }
        $n18 = Round-Money (Parse-Vn $c.C18); $n19 = Round-Money (Parse-Vn $c.C19); $n20 = Round-Money (Parse-Vn $c.C20)
        if ($n19 -and [Math]::Abs($g + $n18 - $n19) -le 2) { $no++ } elseif ($n20 -and [Math]::Abs($g + $n19 - $n20) -le 2) { $yes++ }
    }
    $rateCol = if ($yes -gt $no) { $true } elseif ($no -gt $yes) { $false } else { $null }
    if ($raw.Count -and $null -eq $rateCol -and @($raw | Where-Object { Round-Money (Parse-Vn $_.Goods) }).Count) {
        $c0 = $raw[0]
        throw "lưới dòng hàng: Tiền hàng + Tiền VAT ≠ Tổng tiền ở mọi dòng (dòng 1: Tiền hàng '$($c0.Goods)', cột 18–20 '$($c0.C18)' / '$($c0.C19)' / '$($c0.C20)') — VietDA đổi thứ tự cột?"
    }
    $lines = [System.Collections.Generic.List[object]]::new()
    $i = 0
    foreach ($c in $raw) {
        $i++
        $lines.Add([pscustomobject]@{
            No = $i; Code = ([string]$c.Code).Trim(); Item = ([string]$c.Name).Trim()
            Qty = Parse-Vn $c.Qty; Price = Parse-Vn $c.Price
            Goods = Round-Money (Parse-Vn $c.Goods); Disc = Round-Money (Parse-Vn $c.Disc)
            Vat = Round-Money (Parse-Vn $(if ($rateCol) { $c.C19 } else { $c.C18 }))
            Total = Round-Money (Parse-Vn $(if ($rateCol) { $c.C20 } else { $c.C19 })); Cost = Parse-Vn $c.Cost
            TkNo = ([string]$c.TkNo).Trim(); TkCo = ([string]$c.TkCo).Trim(); NoGv = ([string]$c.NoGv).Trim(); CoGv = ([string]$c.CoGv).Trim()
            InvNo = $(if ($rateCol) { $soHdCell = $c.C21 } else { $soHdCell = $c.C20 }; if ($null -eq $soHdCell) { $null } else { ([string]$soHdCell).Trim() })   # $null = ô không mở được (F2) → không kiểm
            Rate = $(if ($rateCol -and $null -ne $c.C18) { ([string]$c.C18).Trim() } else { $null })
        })
    }
    return [pscustomobject]@{ Lines = $lines; RateCol = $rateCol }
}

function Read-VoucherForm([IntPtr]$Form) {
    # chờ nạp xong: Số CT có chữ, đọc 2 lần như nhau, VietDA rảnh
    $kids = $null; $prev = $null; $deadline = (Get-Date).AddSeconds($FormTimeoutSec)
    while ($true) {
        Wait-Idle $Form 10
        $kids = @(Get-VisibleKids $Form)
        $soLb = @($kids | Where-Object { $_.Cls -like '*STATIC*' -and $_.Text -eq 'Số CT' }) | Select-Object -First 1
        $so = if ($soLb) { @($kids | Where-Object { $_.Cls -clike 'WindowsForms10.EDIT*' -and $_.L -ge $soLb.R - 4 -and [Math]::Abs($_.CY - $soLb.CY) -le 8 } | Sort-Object L | ForEach-Object { [Vdb]::TextOf($_.H) }) | Select-Object -First 1 } else { $null }
        if ($so -and $so -eq $prev) { break }
        $prev = $so
        if ((Get-Date) -gt $deadline) { throw "phiếu mở quá $FormTimeoutSec giây chưa có Số CT$(if (-not $soLb) { " (không thấy nhãn 'Số CT' — VietDA đổi giao diện?)" })" }
        Start-Sleep -Milliseconds 300
    }
    $isField = { param($k) $k.Cls -clike 'WindowsForms10.EDIT*' -or $k.Cls -clike 'WindowsForms10.COMBOBOX*' -or $k.Cls -like '*SysDateTimePick32*' }
    $labels = @($kids | Where-Object { $_.Cls -like '*STATIC*' -and $_.Text } | Sort-Object T, L)
    $val = {
        param([string]$Label, [int]$Nth = 0)
        $lb = @($labels | Where-Object { $_.Text -eq $Label }) | Select-Object -Skip $Nth -First 1
        if (-not $lb) { return $null }
        $f = @($kids | Where-Object { (& $isField $_) -and $_.L -ge $lb.R - 4 -and [Math]::Abs($_.CY - $lb.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
        if ($f) { ([Vdb]::TextOf($f.H)).Trim() } else { $null }
    }
    $bval = {
        param([string]$Label)
        $lb = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq $Label } | Sort-Object T) | Select-Object -Last 1
        if (-not $lb) { return $null }
        $f = @($kids | Where-Object { $_.Cls -clike 'WindowsForms10.EDIT*' -and $_.L -ge $lb.R - 4 -and [Math]::Abs($_.CY - $lb.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
        if ($f) { Round-Money (Parse-Vn ([Vdb]::TextOf($f.H))) } else { $null }
    }
    $need ='Số CT', 'Lý do', 'Ký hiệu', 'Số hóa đơn', 'Ghi nợ', 'Ghi có', 'Phương thức TT'
    $miss = @($need | Where-Object { $null -eq (& $val $_) })
    if ($miss.Count) { throw "phiếu thiếu ô: $($miss -join ', ') (VietDA đổi giao diện?)" }
    # ô tick
    $fr = [Vdb]::Rect($Form)
    $sc = [Math]::Max(1.0, $script:screenScale)
    $bmp = [VdForm]::Snap($Form, [int](($fr.R - $fr.L) * $sc), [int](($fr.B - $fr.T) * $sc))
    try {
        # ô tick cao 17px; nút bấm cùng chữ (vd nút "Hóa đơn" góc dưới) cao 23px → chỉ lấy control thấp hơn 20px
        $tick = { param($t) $b = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq $t -and ($_.B - $_.T) -lt 20 } | Sort-Object T) | Select-Object -First 1; if ($b) { Test-Ticked $bmp $fr $b } else { $null } }
        $pixRate = & $tick $ShowRateBox
        $hasInv = & $tick 'Hóa đơn'
    } finally { $bmp.Dispose() }
    $grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and -not $_.Text -and ($_.R - $_.L) -gt 600 -and ($_.B - $_.T) -gt 120 } | Sort-Object { ($_.B - $_.T) } -Descending) | Select-Object -First 1
    if (-not $grid) { throw 'không thấy lưới dòng hàng trên phiếu' }
    $g = Read-FormGrid $grid.H
    # lưới nạp chậm hơn đầu phiếu (máy kế toán 13/11/2026: XH1374 lần đọc ra 0 dòng, lần trước 3 dòng) → đọc lại
    for ($k = 1; $k -le 2 -and -not $g.Lines.Count; $k++) {
        Write-Log WARN "  lưới dòng hàng trống — chờ rồi đọc lại (lần $k)"
        Start-Sleep -Milliseconds 1500; Wait-Idle $Form
        $g = Read-FormGrid $grid.H
    }
    $lines = $g.Lines
    # ô "Hiển thị thuế suất từng mặt hàng": cột Loại thuế trên lưới là chắc chắn nhất; không xác định (phiếu toàn dòng 0 đ) → theo ảnh
    $showRate = if ($null -ne $g.RateCol) { $g.RateCol } else { $pixRate }
    if ($null -ne $g.RateCol -and $null -ne $pixRate -and $pixRate -ne $g.RateCol -and -not $script:tickWarned) {
        Write-Log WARN "Ô tick '$ShowRateBox' đọc theo ảnh = $pixRate nhưng lưới $(if ($g.RateCol) { 'có' } else { 'không có' }) cột Loại thuế → theo lưới (ảnh lệch? Scale màn hình $([Math]::Round($script:screenScale * 100))%)"
        $script:tickWarned = $true
    }
    if ($null -eq $hasInv -and -not $script:invWarned) {
        Write-Log WARN "Không dò được ô tick 'Hóa đơn' trên ảnh phiếu (Scale màn hình $([Math]::Round($script:screenScale * 100))%) → không kiểm ô này"
        $script:invWarned = $true
    }
    $v = [pscustomobject]@{
        SoCt = & $val 'Số CT'; DocDate = & $val 'Ngày' 0; InvDate = & $val 'Ngày' 1
        Customer = & $val 'Đối tượng'; Name = & $val 'Đơn vị'; Mst = & $val 'MST/CC'
        Reason = & $val 'Lý do'; TaxType = & $val 'Loại thuế'
        Symbol = & $val 'Ký hiệu'; SoHd = & $val 'Số hóa đơn'
        TkNo = & $val 'Ghi nợ'; TkCo = & $val 'Ghi có'; Pay = & $val 'Phương thức TT'
        HGoods = Round-Money (Parse-Vn (& $val 'Tiền hàng')); HVat = Round-Money (Parse-Vn (& $val 'Tiền thuế'))
        ShowRate = $showRate; HasInvoice = $hasInv
        # góc dưới phiếu (nhãn là nút bấm): mẫu kế toán 13/11/2026 — tiền mặt Thanh toán = Tổng hóa đơn, chuyển khoản Thanh toán 0 / Còn nợ = tổng
        Paid = & $bval 'Thanh toán'; Debt = & $bval 'Còn nợ'; InvTotal = & $bval 'Tổng hóa đơn'
        Lines = $lines
    }
    Complete-Voucher $v
}

# Trường suy ra (dùng chung khi đọc từ VietDA và từ phieu-vietda.json)
function Complete-Voucher($V) {
    $d = { param($s) $t = [datetime]::MinValue; if ($s -and [datetime]::TryParseExact(([string]$s).Trim().Substring(0, [Math]::Min(10, ([string]$s).Trim().Length)), 'dd/MM/yyyy', $Inv, 'None', [ref]$t)) { $t.Date } else { $null } }
    $lines = [System.Collections.Generic.List[object]]::new()
    foreach ($l in @($V.Lines)) { if ($l) { $lines.Add($l) } }
    $V.Lines = $lines
    $date = & $d $V.InvDate; if (-not $date) { $date = & $d $V.DocDate }
    $V | Add-Member -Force Date $date
    $V | Add-Member -Force Goods ([long](($lines | Measure-Object Goods -Sum).Sum))
    $V | Add-Member -Force Vat ([long](($lines | Measure-Object Vat -Sum).Sum))
    $V | Add-Member -Force Disc ([long](($lines | Measure-Object Disc -Sum).Sum))
    $V | Add-Member -Force Number ($(if ("$($V.SoHd)" -match '^\s*0*(\d+)\s*$') { [long]$Matches[1] } else { $null }))
    return $V
}

# Bấm vào lưới dòng hàng trước khi Thoát: con trỏ còn ở ô Số CT thì lúc đóng VietDA kiểm ô đó → "Chưa có Số cho chứng từ này !?"
function Close-VoucherForm([IntPtr]$Form) {
    if (-not [VdForm]::IsWindow($Form)) { return '' }
    $kids = @(Get-VisibleKids $Form)
    $grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and -not $_.Text -and ($_.R - $_.L) -gt 600 -and ($_.B - $_.T) -gt 200 } | Sort-Object { ($_.B - $_.T) } -Descending) | Select-Object -First 1
    if ($grid) { [void][VdForm]::Click($grid.H, $FormRow1.X, $FormRow1.Y) }
    $quit = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Thoát*' }) | Select-Object -First 1
    if (-not $quit) { throw "phiếu không có nút Thoát" }
    [Vdb]::ClickButton($quit.H)
    $note = ''
    # Đóng phiếu mà VietDA hỏi "Bạn có muốn lưu dữ liệu không ?" (Yes/No/Cancel) → No: tool không sửa gì (hoặc đã Lưu xong ở -Fix),
    # VietDA tự đổi phiếu lúc mở (thấy 13/11/2026 trên máy kế toán: phiếu Hội nhập XML có "Ngày giờ" = hôm nay) → không lưu, giữ bản cũ
    $answer = {
        $d = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
        if (-not $d) { return $null }
        $text = [Vdb]::MessageText($d)
        if ($text -like '*muốn lưu*' -and [Vdb]::GetDlgItem($d, 7) -ne [IntPtr]::Zero) {
            [Vdb]::Press($d, 7)
            Start-Sleep -Milliseconds 400
            Write-Log WARN "  VietDA hỏi lưu khi đóng phiếu (VietDA tự đổi phiếu lúc mở) → chọn No, không lưu"
            return "VietDA hỏi 'Bạn có muốn lưu dữ liệu không?' khi đóng → No (không lưu)"
        }
        return (Take-Dialog 'đóng phiếu')
    }
    $deadline = (Get-Date).AddSeconds($FormTimeoutSec)
    while ([VdForm]::IsWindow($Form) -and [Vdb]::IsWindowVisible($Form) -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 150
        if ([Vdb]::Dialogs($script:vda.Pid).Count) { $note = & $answer }
    }
    Start-Sleep -Milliseconds 200
    if ([Vdb]::Dialogs($script:vda.Pid).Count) { $note = & $answer }
    if ([VdForm]::IsWindow($Form) -and [Vdb]::IsWindowVisible($Form)) { throw "không đóng được phiếu (bấm Thoát quá $FormTimeoutSec giây)" }
    return $note
}

# ---------- -Fix: sửa đầu phiếu + Lưu (thử trên data test MINH QUY 10/11/2026) ----------
# Hộp thoại khi sửa: "điền tự động cho cột TK Có và Nợ CK" → Yes (user chốt 10/11/2026); 1 nút → ghi lại + OK; hỏi khác nhiều nút → dừng.
function Wait-FixDialogs([string]$Step, [int]$Ms = 1200) {
    $notes = [System.Collections.Generic.List[string]]::new()
    $end = (Get-Date).AddMilliseconds($Ms)
    while ((Get-Date) -lt $end) {
        $d = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
        if (-not $d) { Start-Sleep -Milliseconds 150; continue }
        $text = [Vdb]::MessageText($d)
        if ($text -like '*điền tự động*') { [Vdb]::Press($d, 6); $notes.Add('điền tự động TK dòng hàng: Yes') }
        elseif ($null -ne $text -and [Vdb]::ButtonCount($d) -le 1) { [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 })); $notes.Add($text) }
        else { throw "VietDA hỏi ở bước $Step`: [$([Vdb]::TextOf($d))] $text" }
        Start-Sleep -Milliseconds 500
        $end = (Get-Date).AddMilliseconds([Math]::Max(600, $Ms / 2))
    }
    return , $notes
}

# Sửa hỏng giữa chừng → không để phiếu dở: OK/No mọi hộp thoại, Thoát, "Bạn có muốn lưu dữ liệu không ?" → No
function Undo-VoucherForm([IntPtr]$Form) {
    for ($k = 0; $k -lt 3; $k++) {
        $d = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
        if (-not $d) { break }
        if ([Vdb]::GetDlgItem($d, 7) -ne [IntPtr]::Zero) { [Vdb]::Press($d, 7) } else { [Vdb]::Press($d, 2) }
        Start-Sleep -Milliseconds 500
    }
    if (-not ([VdForm]::IsWindow($Form) -and [Vdb]::IsWindowVisible($Form))) { return }
    $quit = @(Get-VisibleKids $Form | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Thoát*' }) | Select-Object -First 1
    if ($quit) { [Vdb]::ClickButton($quit.H) }
    $end = (Get-Date).AddSeconds(10)
    while ([VdForm]::IsWindow($Form) -and [Vdb]::IsWindowVisible($Form) -and (Get-Date) -lt $end) {
        $d = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
        if ($d) {
            $btns = @([Vdb]::Descendants($d) | Where-Object { [Vdb]::ClassOf($_) -eq 'Button' } | ForEach-Object { [Vdb]::TextOf($_) }) -join '/'
            $txt = @([Vdb]::Descendants($d) | Where-Object { [Vdb]::ClassOf($_) -eq 'Static' } | ForEach-Object { [Vdb]::TextOf($_) } | Where-Object { $_ }) -join ' '
            $hasNo = [Vdb]::GetDlgItem($d, 7) -ne [IntPtr]::Zero
            if ($hasNo) { [Vdb]::Press($d, 7) } else { [Vdb]::Press($d, 2) }
            Write-Log WARN "Hủy sửa: hộp '$([Vdb]::TextOf($d))' [$txt] nút [$btns] → $(if ($hasNo) { 'No' } else { 'OK/Cancel' })"
        }
        Start-Sleep -Milliseconds 300
    }
    if ([VdForm]::IsWindow($Form) -and [Vdb]::IsWindowVisible($Form)) { throw 'sửa lỗi và không đóng được phiếu — kiểm phiếu đang mở trên VietDA (KHÔNG lưu)' }
}

# Điền 1 ô đầu phiếu theo nhãn: ô chọn có sẵn mục đúng chữ → chọn mục; không thì gõ chữ (WM_SETTEXT, không qua Unikey) vào ô.
# Rời ô = click lưới dòng hàng → VietDA kiểm ô / hỏi điền tự động.
function Set-HeaderField($Kids, [IntPtr]$Grid, [string]$Label, [string]$Value) {
    $lb = @($Kids | Where-Object { $_.Cls -like '*STATIC*' -and $_.Text -eq $Label }) | Select-Object -First 1
    # ô góc dưới (Thanh toán…) có nhãn là NÚT bấm cùng chữ → lấy nút thấp nhất
    if (-not $lb) { $lb = @($Kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq $Label } | Sort-Object T) | Select-Object -Last 1 }
    if (-not $lb) { throw "không thấy nhãn '$Label'" }
    $c = @($Kids | Where-Object { ($_.Cls -clike 'WindowsForms10.EDIT*' -or $_.Cls -clike 'WindowsForms10.COMBOBOX*') -and $_.L -ge $lb.R - 4 -and [Math]::Abs($_.CY - $lb.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
    if (-not $c) { throw "không thấy ô '$Label'" }
    $par = [Vdb]::GetParent($c.H)
    $how = ''; $diag = ''
    if ($c.Cls -clike 'WindowsForms10.COMBOBOX*') {
        $items = @([Vdb]::ComboItems($c.H))
        # ô chọn nạp mục lúc xổ xuống (Lý do, Ghi nợ… 0 mục khi mới mở phiếu) → xổ xuống rồi đóng (CB_SHOWDROPDOWN) cho VietDA nạp
        if (-not $items.Count) {
            [void][VdForm]::Send($c.H, 0x14F, [IntPtr]1, [IntPtr]::Zero); Start-Sleep -Milliseconds 400
            [void][VdForm]::Send($c.H, 0x14F, [IntPtr]::Zero, [IntPtr]::Zero); Start-Sleep -Milliseconds 200
            $items = @([Vdb]::ComboItems($c.H))
        }
        $want = Normalize-Name $Value
        $idx = -1; for ($i = 0; $i -lt $items.Count -and $idx -lt 0; $i++) { if ($items[$i] -eq $Value -or (Normalize-Name $items[$i]) -eq $want) { $idx = $i } }
        $near = @($items | Where-Object { (Normalize-Name $_) -like "*$((Normalize-Name ($Value -split ' ')[0]))*" } | Select-Object -First 5)
        $diag = "ô có $($items.Count) mục$(if ($near.Count) { "; gần giống: '$($near -join "', '")'" })"
    }
    # ô hiện tại tìm lại theo nhãn: VietDA TẠO LẠI combo (Lý do, Ghi nợ…) khi ô nhận focus lẫn khi rời ô → handle cũ đọc ra '' (lỗi 13/11/2026)
    $current = { $x = @(@(Get-VisibleKids $par) | Where-Object { ($_.Cls -clike 'WindowsForms10.EDIT*' -or $_.Cls -clike 'WindowsForms10.COMBOBOX*') -and $_.L -ge $lb.R - 4 -and [Math]::Abs($_.CY - $lb.CY) -le 8 } | Sort-Object L) | Select-Object -First 1; if ($x) { $x } else { $c } }
    $isOk = { param($got) $got -eq $Value -or ($Value -match '^\d+$' -and $null -ne (Parse-Vn $got) -and (Round-Money (Parse-Vn $got)) -eq [long]$Value) }   # ô số: "83000" → "83.000"
    # Ô chọn chỉ nhận chữ khi CÓ FOCUS (đặt chữ lúc không focus → rời ô trả giá trị cũ). Đo 14/11/2026 data test: focus thật KHÔNG cần
    # foreground (AttachThreadInput + SetFocus) → đặt chữ vào ô ĐANG focus (combo vừa tạo lại) → Tab → rời ô (click lưới).
    $typeFocused = {
        $cc = & $current
        # ô chữ thường (Ký hiệu, Số HĐ, Thanh toán) cũng vậy: đặt chữ không focus → đọc lại đúng nhưng Lưu báo "Dữ liệu không thay đổi" (14/11/2026)
        $e = if ($cc.Cls -clike 'WindowsForms10.EDIT*') { $cc.H } else { @([Vdb]::Descendants($cc.H) | Where-Object { [Vdb]::ClassOf($_) -eq 'Edit' }) | Select-Object -First 1 }
        if (-not $e) { throw "ô '$Label' không gõ được" }
        $fe = [VdForm]::FocusNoActivate($e)
        if ($fe -eq [IntPtr]::Zero -or [Vdb]::ClassOf($fe) -notlike '*Edit*') { Write-Log WARN "    ô '$Label': không lấy được focus (đang focus '$([Vdb]::ClassOf($fe))') → đặt chữ thẳng"; $fe = $e }
        [void][Vdb]::SetText($fe, $Value)
        [VdForm]::PostKey($fe, 0x09)
        Start-Sleep -Milliseconds 500
        "đặt chữ khi có focus$(if ($fe -ne $e) { ' (combo tạo lại)' })"
    }
    $notes = [System.Collections.Generic.List[string]]::new()
    if ($c.Cls -clike 'WindowsForms10.COMBOBOX*') {
        if ($idx -ge 0) { $Value = $items[$idx] }
        if ($idx -ge 0 -and $Label -ne 'Lý do') { [Vdb]::SelectCombo($c.H, $idx); $how = "chọn mục $idx" } else { $how = & $typeFocused }
    } else { $how = & $typeFocused }
    [void][VdForm]::Click($Grid, $FormRow1.X, $FormRow1.Y)
    foreach ($n in @(Wait-FixDialogs "điền '$Label'")) { if ($n) { $notes.Add($n) } }
    $got = ([Vdb]::TextOf((& $current).H)).Trim()
    # chọn mục không ăn (Ghi nợ '131' chọn mục → đọc lại '' — data test 14/11/2026) → đặt chữ khi có focus
    if (-not (& $isOk $got) -and $how -like 'chọn mục*') {
        Write-Log WARN "    ô '$Label': chọn mục ra '$got' → thử đặt chữ khi có focus"
        $how = "$how → $(& $typeFocused)"
        [void][VdForm]::Click($Grid, $FormRow1.X, $FormRow1.Y)
        foreach ($n in @(Wait-FixDialogs "điền '$Label'")) { if ($n) { $notes.Add($n) } }
        $got = ([Vdb]::TextOf((& $current).H)).Trim()
    }
    if (-not (& $isOk $got)) { throw "ô '$Label' điền '$Value' ($how) nhưng đọc lại '$got'$(if ($diag) { " — $diag" })" }
    Write-Log INFO "    $Label → '$Value' ($how)$(if ($notes.Count) { ' — ' + ($notes -join '; ') })"
    return , $notes
}

# Sửa các ô Auto của 1 phiếu đang mở rồi Lưu. Lỗi → hủy (không lưu), ném lỗi. Trả về danh sách việc đã làm.
function Invoke-HeaderFix([IntPtr]$Form, $Fixes) {
    $kids = @(Get-VisibleKids $Form)
    $grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and -not $_.Text -and ($_.R - $_.L) -gt 600 -and ($_.B - $_.T) -gt 120 } | Sort-Object { ($_.B - $_.T) } -Descending) | Select-Object -First 1
    $save = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Lưu' }) | Select-Object -First 1
    if (-not $grid -or -not $save) { throw 'phiếu không có lưới dòng hàng / nút Lưu' }
    $done = [System.Collections.Generic.List[string]]::new()
    # Lý do trước: điền hỏng thì hủy sớm, đỡ phí các ô khác (caller mở lại phiếu sửa tiếp không Lý do)
    $Fixes = @($Fixes | Where-Object { $_.Field -ne 'Thu tiền' } | Sort-Object { if ($_.Field -eq 'Lý do') { 0 } else { 1 } })   # Thu tiền: sau khi Lưu (Invoke-ThuTien)
    try {
        foreach ($f in $Fixes) {
            $to = [string]$f.To
            if ($f.Field -eq 'Phương thức TT') {
                # ô chọn có cả "CK"/"TM" lẫn "Chuyển khoản"/"Tiền mặt" → đúng chữ XML nếu có, không thì mã ngắn
                $lb = @($kids | Where-Object { $_.Cls -like '*STATIC*' -and $_.Text -eq $f.Field }) | Select-Object -First 1
                $cb = @($kids | Where-Object { $_.Cls -clike 'WindowsForms10.COMBOBOX*' -and $_.L -ge $lb.R - 4 -and [Math]::Abs($_.CY - $lb.CY) -le 8 } | Sort-Object L) | Select-Object -First 1
                $items = if ($cb) { @([Vdb]::ComboItems($cb.H)) } else { @() }
                if ($items -notcontains $to) { $to = Get-PayKind $to }
            }
            [void](Set-HeaderField $kids $grid.H $f.Field $to)
            $done.Add($f.Text)
        }
        [Vdb]::ClickButton($save.H)
        $notes = Wait-FixDialogs 'Lưu' 5000
        if (-not @($notes | Where-Object { $_ -like '*thành công*' }).Count) { throw "bấm Lưu nhưng VietDA không báo lưu thành công ($($notes -join '; '))" }
    } catch {
        $err = $_.Exception.Message
        Write-Log ERROR "    sửa lỗi: $err → hủy, không lưu"
        Undo-VoucherForm $Form
        throw $err
    }
    return , $done
}

# VietDA văng lỗi .NET ("Unhandled exception… Continue / Quit") → bấm Continue (KHÔNG Quit: đóng cả VietDA), trả về dòng lỗi
function Close-CrashDialog {
    foreach ($t in [Vdb]::Tops($script:vda.Pid)) {
        if ($t -eq $script:vda.Main) { continue }
        $cont = @([Vdb]::Descendants($t) | Where-Object { [Vdb]::TextOf($_) -eq '&Continue' }) | Select-Object -First 1
        if (-not $cont) { continue }
        $msg = @([Vdb]::Descendants($t) | ForEach-Object { [Vdb]::TextOf($_) } | Where-Object { $_ -like 'Unhandled exception*' }) | Select-Object -First 1
        [Vdb]::ClickButton($cont)
        Start-Sleep -Milliseconds 500
        $line = (($msg -split "`n") | Where-Object { $_.Trim() } | Select-Object -Last 1)
        Write-Log ERROR "    VietDA văng lỗi: $line → bấm Continue"
        return "VietDA văng lỗi: $line"
    }
    return $null
}

# "Nhiều hóa đơn…" trên phiếu XH: kế toán (14/11/2026) — XÓA HẾT, không thì VietDA ghi HĐ 2 lần (đầu phiếu + danh sách này).
# Hộp thoại cùng tiêu đề 'Xuất bán hàng' (cửa sổ riêng). Đo data test 14/11/2026: nút Xóa của hộp KHÔNG ăn khi bấm bằng message →
# chọn cả dòng (bấm ô đầu dòng) + phím Delete vào lưới; xóa xong phải Lưu (đóng không Lưu → hỏi "muốn lưu"). Gọi khi đầu phiếu đã đúng HĐ.
function Clear-ManyInvoices([IntPtr]$Form) {
    $btn = @(Get-VisibleKids $Form | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Nhiều hóa đơn*' }) | Select-Object -First 1
    if (-not $btn) { throw "phiếu không có nút 'Nhiều hóa đơn…'" }
    $before = @{}; foreach ($t in [Vdb]::Tops($script:vda.Pid)) { $before[$t.ToInt64()] = $true }
    [Vdb]::ClickButton($btn.H)
    $dlg = $null; $end = (Get-Date).AddSeconds(10)
    while (-not $dlg -and (Get-Date) -lt $end) {
        Start-Sleep -Milliseconds 200
        $dlg = @([Vdb]::Tops($script:vda.Pid) | Where-Object { -not $before.ContainsKey($_.ToInt64()) -and [Vdb]::TextOf($_) -eq $FormTitle }) | Select-Object -First 1
    }
    if (-not $dlg) { throw "bấm 'Nhiều hóa đơn…' không thấy hộp danh sách hóa đơn" }
    Start-Sleep -Milliseconds 400; Wait-Idle $dlg
    $kids = @(Get-VisibleKids $dlg)
    $grid = @($kids | Where-Object { $_.Cls -like '*Window.8*' -and -not $_.Text -and ($_.B - $_.T) -gt 200 } | Sort-Object { $_.B - $_.T } -Descending) | Select-Object -First 1
    $btnOf = { param($n) @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like $n }) | Select-Object -First 1 }
    $G = $grid.H
    $editor = { @([Vdb]::Descendants($G) | Where-Object { [Vdb]::ClassOf($_) -clike 'WindowsForms10.EDIT*' -and [Vdb]::IsWindowVisible($_) }) | Select-Object -First 1 }
    # dòng 1: Mẫu HĐ | Ký hiệu | Số HĐ (F2 → đọc → Esc, như lưới dòng hàng)
    $row1 = {
        [void][VdForm]::Click($G, $FormRow1.X + 40, $FormRow1.Y); [void][VdForm]::Key($G, 0x24)
        $vals = for ($c = 0; $c -lt 3; $c++) {
            [void][VdForm]::Key($G, 0x71); $e = & $editor
            if ($e) { ([Vdb]::TextOf($e)).Trim(); [void][VdForm]::Key($e, 0x1B) } else { '' }
            [void][VdForm]::Key($G, 0x27)
        }
        [void][VdForm]::Key($G, 0x24)
        @($vals)
    }
    $removed = [System.Collections.Generic.List[string]]::new()
    try {
        for ($n = 0; $n -lt 50; $n++) {
            $r = & $row1
            if (-not (@($r | Where-Object { $_ }).Count)) { break }
            $removed.Add("$($r[0])|$($r[1])|$($r[2])")
            [void][VdForm]::Click($G, 8, $FormRow1.Y); Start-Sleep -Milliseconds 150   # ô đầu dòng = chọn cả dòng
            [void][VdForm]::Key($G, 0x2E)
            foreach ($x in @(Wait-FixDialogs 'xóa dòng Nhiều hóa đơn' 800)) { }
            if ($n -gt 0 -and $removed[$n] -eq $removed[$n - 1]) { throw "phím Delete không xóa được dòng '$($removed[$n])'" }
        }
        if ($removed.Count) {
            [Vdb]::ClickButton((& $btnOf 'Lưu').H)
            $notes = @(Wait-FixDialogs 'Lưu Nhiều hóa đơn' 3000)
            if (-not @($notes | Where-Object { $_ -like '*thành công*' }).Count) { throw "xóa $($removed.Count) dòng nhưng Lưu không báo thành công ($($notes -join '; '))" }
            if (@(& $row1 | Where-Object { $_ }).Count) { throw 'Lưu xong vẫn còn dòng' }
        }
    } finally {
        $quit = & $btnOf 'Thoát*'
        if ($quit -and [Vdb]::IsWindowVisible($dlg)) { [Vdb]::ClickButton($quit.H) }
        $end = (Get-Date).AddSeconds(8)
        while ([Vdb]::IsWindowVisible($dlg) -and (Get-Date) -lt $end) {
            Start-Sleep -Milliseconds 200
            $m = @([Vdb]::Dialogs($script:vda.Pid)) | Select-Object -First 1
            if (-not $m) { continue }
            # chưa Lưu được (lỗi ở trên) → No: không ghi thay đổi dở
            if ([Vdb]::MessageText($m) -like '*muốn lưu*') { [Vdb]::Press($m, 7); Write-Log WARN '    Nhiều hóa đơn: đóng hỏi lưu → No' }
            else { [void](Take-Dialog 'đóng Nhiều hóa đơn') }
        }
    }
    if ($removed.Count) { Write-Log INFO "    Nhiều hóa đơn: xóa $($removed.Count) dòng (Mẫu|Ký hiệu|Số HĐ: $($removed -join '; ')) + Lưu" }
    return $removed.Count
}

# Đóng phiếu thu xong VietDA nhảy về tab đầu → tab phiếu XH bị ẩn (nút ẩn không bấm được). Bấm lại tab của phiếu: thử vị trí theo
# thứ tự trang con (khớp thứ tự tab — thấy 14/11/2026), không trúng thì thử các tab khác tới khi phiếu hiện.
function Show-FormTab([IntPtr]$Form) {
    if ([Vdb]::IsWindowVisible($Form)) { return $true }
    $page = [Vdb]::GetParent($Form); $tab = [Vdb]::GetParent($page)
    if ([Vdb]::ClassOf($tab) -notlike '*SysTabControl32*') { Write-Log WARN "    không thấy thanh tab của phiếu ($([Vdb]::ClassOf($tab)))"; return $false }
    $pages = @([Vdb]::Descendants($tab) | Where-Object { [Vdb]::GetParent($_) -eq $tab })
    $first = [Array]::IndexOf($pages, $page)
    foreach ($i in @(@($first) + @(0..([Math]::Max(0, $pages.Count - 1)) | Where-Object { $_ -ne $first })) | Where-Object { $_ -ge 0 }) {
        if (-not [VdForm]::ClickTab($tab, $i)) { continue }
        $end = (Get-Date).AddSeconds(2)
        while ((Get-Date) -lt $end -and -not [Vdb]::IsWindowVisible($Form)) { Start-Sleep -Milliseconds 100 }
        if ([Vdb]::IsWindowVisible($Form)) { return $true }
    }
    Write-Log WARN "    không bấm lại được tab '$([Vdb]::TextOf($page))'"
    return $false
}

# Phiếu tiền mặt: nút "Thu tiền" trên phiếu XH ĐÃ LƯU → VietDA tạo + LƯU NGAY phiếu thu tiền mặt (TM…; đo 14/11/2026 data test:
# XH Nợ 1111 → phiếu thu Nợ 1111/Có 5111 + Nợ 1111/Có 33311; XH Nợ 131 → Nợ 1111/Có 131) và ghi Thanh toán = Tổng hóa đơn lên phiếu XH.
# Kế toán (14/11/2026): Thu tiền → Lưu → OK (Lưu thường báo "Dữ liệu không thay đổi" vì đã lưu sẵn) → đóng phiếu thu.
# Phiếu XH CHƯA lưu bấm Thu tiền → VietDA văng lỗi FormatException và lưu 1 phiếu XH rỗng → chỉ gọi trên phiếu mở từ danh sách.
function Invoke-ThuTien([IntPtr]$Form) {
    $btn = @(Get-VisibleKids $Form | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Thu tiền' }) | Select-Object -First 1
    if (-not $btn) { throw "phiếu không có nút 'Thu tiền'" }
    $isPt = { param($h) [Vdb]::IsWindowVisible($h) -and [Vdb]::TextOf($h) -eq $CashReceiptTitle }
    $known = @{}; foreach ($h in [Vdb]::Descendants($script:vda.Main)) { if (& $isPt $h) { $known[$h.ToInt64()] = $true } }
    [Vdb]::ClickButton($btn.H)
    $pt = $null; $notes = [System.Collections.Generic.List[string]]::new()
    $deadline = (Get-Date).AddSeconds($FormTimeoutSec)
    while (-not $pt -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 200
        $crash = Close-CrashDialog
        if ($crash) { throw "bấm Thu tiền: $crash" }
        if ([Vdb]::Dialogs($script:vda.Pid).Count) { $notes.Add((Take-Dialog 'bấm Thu tiền')); continue }
        $pt = @([Vdb]::Descendants($script:vda.Main) | Where-Object { -not $known.ContainsKey($_.ToInt64()) -and (& $isPt $_) }) | Select-Object -First 1
    }
    if (-not $pt) { throw "bấm Thu tiền quá $FormTimeoutSec giây không thấy '$CashReceiptTitle'$(if ($notes.Count) { " ($($notes -join '; '))" })" }
    Start-Sleep -Milliseconds 500; Wait-Idle $pt
    $kids = @(Get-VisibleKids $pt)
    $so = (@($kids | Where-Object { $_.Cls -clike 'WindowsForms10.EDIT*' } | Sort-Object T, L) | Select-Object -First 1).Text
    $save = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Lưu' }) | Select-Object -First 1
    if ($save) {
        [Vdb]::ClickButton($save.H)
        foreach ($n in @(Wait-FixDialogs 'Lưu phiếu thu' 3000)) { if ($n) { $notes.Add($n) } }
        $crash = Close-CrashDialog
        if ($crash) { $notes.Add($crash) }
    }
    # số tiền: ô sau nút "Tổng thanh toán" (đọc sau Lưu — lúc mới mở có khi chưa điền)
    $kids = @(Get-VisibleKids $pt)
    $lbAmt = @($kids | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Tổng thanh toán' }) | Select-Object -First 1
    $amount = if ($lbAmt) { (@($kids | Where-Object { $_.Cls -clike 'WindowsForms10.EDIT*' -and $_.L -ge $lbAmt.R - 4 -and [Math]::Abs($_.CY - $lbAmt.CY) -le 8 } | Sort-Object L) | Select-Object -First 1).Text } else { '?' }
    $close = Close-VoucherForm $pt
    if ($close) { $notes.Add($close) }
    # đóng phiếu thu → VietDA về tab đầu, phiếu XH ẩn → bấm lại tab phiếu XH để caller đóng / đọc tiếp
    if (-not (Show-FormTab $Form)) { $notes.Add('phiếu XH bị ẩn sau khi đóng phiếu thu') }
    Write-Log INFO "    Thu tiền → phiếu thu $so, $amount đ$(if ($notes.Count) { ' — ' + ($notes -join '; ') })"
    return "Thu tiền → phiếu thu $so ($amount đ)"
}

# XML của 1 phiếu ngay lúc đọc (để -Fix): Ký hiệu + Số HĐ, hoặc ngày + tiền hàng + thuế + số dòng khớp hẳn.
# Ghép yếu hơn (tiền lệch) → không tự sửa, chỉ báo.
function Find-XmlFor($V, $Xmls) {
    $free = @($Xmls | Where-Object { -not $script:fixUsed.ContainsKey($_.File) })
    if ($null -ne $V.Number) {
        $c = @($free | Where-Object { $_.Number -eq $V.Number -and (Test-Symbol $V.Symbol $_) })
        if ($c.Count -eq 1) { return $c[0] }
    }
    $c = @($free | Where-Object { $_.Date -eq $V.Date -and $_.Goods -eq $V.Goods -and $_.Vat -eq $V.Vat -and (Get-XmlLines $_).Count -eq $V.Lines.Count } | Sort-Object Number)
    if ($c.Count) { return $c[0] }
    return $null
}

# Đọc lần lượt mọi dòng của danh sách; hết danh sách = ↓ không đi nữa (mở lại đúng phiếu vừa đọc)
function Read-AllVouchers([string]$FromD, [string]$ToD, $Xmls) {
    # danh sách đang mở sẵn (kế toán tự Tìm kiếm chứng từ) → dùng luôn, không cần chuột; không có → tự mở theo khoảng ngày XML
    Restore-Vietda
    $listing = @(Find-Listings) | Select-Object -First 1
    $hidden = @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::TextOf($_) -eq $ListingTitle }) | Select-Object -First 1
    if ($listing) { Write-Log WARN "Dùng danh sách '$ListingTitle' đang mở — tool đọc MỌI dòng của danh sách đó (lọc ngày / loại theo lúc bạn tìm)." }
    elseif ($hidden) { throw "danh sách '$ListingTitle' đang mở nhưng nằm sau tab khác — bấm tab 'Tìm kiếm chứng từ' trên VietDA (hoặc đóng nó) rồi chạy lại" }
    else { $listing = Open-XhListing $FromD $ToD }
    $L = Get-ListingParts $listing
    $out = [System.Collections.Generic.List[object]]::new()
    $seen = @{}
    $prev = $null
    $fails = 0
    $fixFails = 0
    $script:fixUsed = @{}
    $script:reasonBroken = $false
    $resync = $true
    # mở + đọc + đóng 1 dòng → phiếu ($null = không mở được)
    $visit = {
        param([int]$Index, [bool]$Full)
        Restore-Vietda
        $o = if ($Full) { Open-ListingRow $L $Index } else { Open-ListingRow $L $Index -Next }
        if (-not $o.Form) { Write-Log WARN "Dòng $($Index + 1): không mở được phiếu ($($o.Note))"; return $null }
        $v = $null; $err = $null
        try { $v = Read-VoucherForm $o.Form } catch { $err = $_.Exception.Message }
        # -Fix: sửa đầu phiếu ngay trên phiếu đang mở → Lưu → đóng → mở lại đúng dòng đó đọc kiểm
        $fixed = $null; $fixErr = $null; $headerSaved = $false; $thuPending = $false; $thu = @()
        if ($Fix -and -not $err) {
            $x = Find-XmlFor $v $Xmls
            $todo = if ($x) { @((Get-HeaderFixes $v $x) | Where-Object { $_.Auto -and -not ($script:reasonBroken -and $_.Field -eq 'Lý do') }) } else { @() }
            if (-not $x) { Write-Log WARN "  $($v.SoCt): không có XML khớp hẳn (Ký hiệu + Số HĐ, hoặc ngày + tiền + thuế + số dòng) → không tự sửa" }
            if ($x) { $script:fixUsed[$x.File] = $true }
            # Thu tiền (phiếu tiền mặt) làm SAU khi đầu phiếu đã lưu đúng — phiếu thu sinh bút toán theo Ghi nợ của phiếu XH
            $thu = @($todo | Where-Object { $_.Field -eq 'Thu tiền' })
            $todo = @($todo | Where-Object { $_.Field -ne 'Thu tiền' })
            # "Nhiều hóa đơn": xóa hết khi đầu phiếu ĐÃ đúng Ký hiệu + Số HĐ theo XML (HĐ vẫn còn ở đầu phiếu)
            $clearNhd = {
                param([IntPtr]$F)
                try { $n = Clear-ManyInvoices $F; if ($n) { "Nhiều hóa đơn: xóa $n dòng" } }
                catch { $script:nhdErr = "Nhiều hóa đơn lỗi: $($_.Exception.Message)"; Write-Log ERROR "    $script:nhdErr" }
            }
            $script:nhdErr = $null
            if ($x -and -not $todo.Count) {
                $nhd = & $clearNhd $o.Form
                if ($nhd) { $fixed = @($nhd) }
                if ($script:nhdErr) { $fixErr = $script:nhdErr }
            }
            if (-not $todo.Count -and $thu.Count) {
                Write-Log INFO "  $($v.SoCt) (HĐ $($x.Kh)/$($x.Number)): đầu phiếu đúng, tiền mặt chưa thu → Thu tiền"
                try { $fixed = @($fixed | Where-Object { $_ }) + @(Invoke-ThuTien $o.Form); $thuPending = $true } catch { $fixErr = "$(if ($fixErr) { "$fixErr; " })Thu tiền lỗi: $($_.Exception.Message)"; Write-Log ERROR "    Thu tiền lỗi: $($_.Exception.Message)" }
            }
            if ($todo.Count) {
                Write-Log INFO "  Sửa $($v.SoCt) (HĐ $($x.Kh)/$($x.Number)): $(($todo | ForEach-Object Text) -join '; ')$(if ($thu.Count) { '; rồi Thu tiền' })"
                try { $fixed = Invoke-HeaderFix $o.Form $todo } catch { $fixErr = $_.Exception.Message }
                # Lý do không điền được (VietDA xóa ô — 13/11/2026 máy kế toán) → các phiếu sau bỏ Lý do; phiếu này mở lại sửa các ô còn lại
                $rest = @($todo | Where-Object { $_.Field -ne 'Lý do' })
                if ($fixErr -and $fixErr -like "ô 'Lý do'*") {
                    if (-not $script:reasonBroken) { Write-Log WARN "  Ô 'Lý do' không điền được ($fixErr) → từ giờ KHÔNG sửa Lý do (ghi 'sửa tay'), vẫn sửa các ô khác" }
                    $script:reasonBroken = $true
                    if ($rest.Count) {
                        $o = Open-ListingRow $L $Index -Same
                        if (-not $o.Form) { throw "dòng $($Index + 1): hủy sửa Lý do xong không mở lại được phiếu ($($o.Note))" }
                        try { [void](Read-VoucherForm $o.Form) } catch { }
                        Write-Log INFO "  Sửa lại $($v.SoCt) (không Lý do): $(($rest | ForEach-Object Text) -join '; ')"
                        try { $fixed = Invoke-HeaderFix $o.Form $rest; $fixErr = $null } catch { $fixErr = $_.Exception.Message }
                    } else { $fixErr = $null }
                }
                $headerSaved = [bool]$fixed
            }
        }
        $closeNote = if ([VdForm]::IsWindow($o.Form) -and [Vdb]::IsWindowVisible($o.Form)) { Close-VoucherForm $o.Form } else { '' }
        if ($err) { throw "dòng $($Index + 1): đọc phiếu lỗi — $err" }
        if ($headerSaved) {
            $o2 = Open-ListingRow $L $Index -Same
            if (-not $o2.Form) { throw "dòng $($Index + 1): đã Lưu nhưng không mở lại được phiếu để kiểm ($($o2.Note))" }
            $v2 = $null; $err2 = $null
            try { $v2 = Read-VoucherForm $o2.Form } catch { $err2 = $_.Exception.Message }
            if ($err2 -or $v2.SoCt -ne $v.SoCt) { [void](Close-VoucherForm $o2.Form) }
            if ($err2) { throw "dòng $($Index + 1): đã Lưu, đọc lại lỗi — $err2" }
            if ($v2.SoCt -ne $v.SoCt) { throw "dòng $($Index + 1): đã Lưu $($v.SoCt) nhưng mở lại ra $($v2.SoCt) — danh sách đổi thứ tự?" }
            $left = @((Get-HeaderFixes $v2 $x) | Where-Object { $_.Auto -and $_.Field -ne 'Thu tiền' -and -not ($script:reasonBroken -and $_.Field -eq 'Lý do') })
            $v = $v2
            Write-Log $(if ($left.Count) { 'WARN' } else { 'OK' }) "  Đã lưu $($v.SoCt)$(if ($left.Count) { " — mở lại vẫn sai: $(($left | ForEach-Object Text) -join '; ')" } else { ', mở lại kiểm: đúng' })"
            if ($left.Count) { $fixErr = "Lưu xong nhưng mở lại vẫn sai: $(($left | ForEach-Object Text) -join '; ')" }
            if (-not @($left | Where-Object { $_.Field -in 'Ký hiệu', 'Số hóa đơn' }).Count) {
                $nhd = & $clearNhd $o2.Form
                if ($nhd) { $fixed = @($fixed) + @($nhd) }
                if ($script:nhdErr) { $fixErr = "$(if ($fixErr) { "$fixErr; " })$script:nhdErr" }
            }
            if ($thu.Count) {
                $badTk = @($left | Where-Object { $_.Field -in 'Phương thức TT', 'Ghi nợ', 'Ghi có' })
                if ($badTk.Count) { $fixErr = "$(if ($fixErr) { "$fixErr; " })không Thu tiền vì PTTT / TK còn sai" }
                else {
                    try { $fixed = @($fixed) + @(Invoke-ThuTien $o2.Form); $thuPending = $true }
                    catch { $fixErr = "$(if ($fixErr) { "$fixErr; " })Thu tiền lỗi: $($_.Exception.Message)"; Write-Log ERROR "    Thu tiền lỗi: $($_.Exception.Message)" }
                }
            }
            if ([VdForm]::IsWindow($o2.Form) -and [Vdb]::IsWindowVisible($o2.Form)) { [void](Close-VoucherForm $o2.Form) }
        }
        # sau Thu tiền: mở lại kiểm Thanh toán = Tổng hóa đơn (Còn nợ 0)
        if ($thuPending) {
            $o3 = Open-ListingRow $L $Index -Same
            if (-not $o3.Form) { throw "dòng $($Index + 1): Thu tiền xong không mở lại được phiếu để kiểm ($($o3.Note))" }
            $v3 = $null; $err3 = $null
            try { $v3 = Read-VoucherForm $o3.Form } catch { $err3 = $_.Exception.Message }
            [void](Close-VoucherForm $o3.Form)
            if ($err3) { throw "dòng $($Index + 1): Thu tiền xong, đọc lại lỗi — $err3" }
            $v = $v3
            $total = if ($v3.InvTotal) { [long]$v3.InvTotal } else { $v3.Goods + $v3.Vat }
            if ([Math]::Abs([long]$v3.Paid - $total) -gt 1) {
                $fixErr = "$(if ($fixErr) { "$fixErr; " })Thu tiền xong nhưng Thanh toán $($v3.Paid) ≠ Tổng hóa đơn $total"
                Write-Log WARN "  $($v3.SoCt): $fixErr"
            } else { Write-Log OK "  $($v3.SoCt): Thu tiền xong — Thanh toán $($v3.Paid), Còn nợ $($v3.Debt)" }
        }
        if ($fixed) { $v | Add-Member -Force Fixed ($fixed -join '; ') }
        if ($fixErr) { $v | Add-Member -Force FixError $fixErr }
        if ($closeNote) { $v | Add-Member -Force Note $closeNote }
        $v | Add-Member -Force Sig "$($v.SoCt)|$($v.DocDate)|$($v.Goods)|$($v.Lines.Count)"
        return $v
    }
    Write-Log WARN 'Đang đọc từng phiếu — KHÔNG bấm vào VietDA (dùng app khác thì được).'
    for ($i = 0; $i -lt 100000; $i++) {
        if ($Limit -gt 0 -and $out.Count -ge $Limit) { Write-Log INFO "Dừng theo -Limit $Limit"; break }
        $t0 = Get-Date
        $v = & $visit $i $resync
        $resync = $false
        if (-not $v) {
            $fails++; $resync = $true
            if ($fails -ge 3) { throw "3 dòng liền không mở được phiếu — dừng" }
            continue
        }
        $fails = 0
        # ↓ không đi (hết danh sách) hoặc lưới mất dòng chọn → chọn lại từ dòng 1 cho chắc
        if ($v.Sig -eq $prev -or $seen.ContainsKey($v.Sig)) {
            Write-Log INFO "Dòng $($i + 1): ↓ ra lại phiếu $($v.SoCt) — chọn lại từ dòng 1 để kiểm"
            $v = & $visit $i $true
            if (-not $v) { $fails++; $resync = $true; continue }
        }
        $sig = $v.Sig
        $v.PSObject.Properties.Remove('Sig')
        if ($sig -eq $prev) { Write-Log INFO "Hết danh sách: $($out.Count) phiếu"; break }
        if ($seen.ContainsKey($sig)) { throw "dòng $($i + 1) mở lại phiếu $($v.SoCt) đã đọc ở dòng $($seen[$sig]) — VietDA không chọn được dòng (có bấm vào VietDA?)" }
        $seen[$sig] = $i + 1; $prev = $sig
        $out.Add($v)
        if ($v.PSObject.Properties['FixError']) { $fixFails++; if ($fixFails -ge 3) { throw "3 phiếu liền sửa lỗi — dừng (lỗi cuối: $($v.FixError))" } } else { $fixFails = 0 }
        Write-Log INFO ("[{0}] {1} {2} HĐ {3}/{4}: {5} dòng, tiền hàng {6:N0}, thuế {7:N0} ({8:N1} giây)" -f ($i + 1), $v.SoCt, $v.InvDate, $v.Symbol, $v.SoHd, $v.Lines.Count, $v.Goods, $v.Vat, ((Get-Date) - $t0).TotalSeconds)
    }
    return , $out
}

function Save-Vouchers([string]$Path, $Vouchers) {
    $plain = @($Vouchers | ForEach-Object { $_ | Select-Object * -ExcludeProperty Date, Goods, Vat, Disc, Number })
    [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $plain -Depth 6), (New-Object Text.UTF8Encoding $true))
}
function Load-Vouchers([string]$Path) {
    $out = [System.Collections.Generic.List[object]]::new()
    # PS 5.1: ConvertFrom-Json trả cả mảng như 1 đối tượng → gán biến trước rồi mới foreach
    $arr = ConvertFrom-Json ([IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8))
    foreach ($v in $arr) { $out.Add((Complete-Voucher $v)) }
    return , $out
}

# ---------- Ghép phiếu ↔ XML ----------
function Get-XmlLines($X) { @($X.Lines | Where-Object { $_.TChat -in '1', '2' }) }
function Match-All($Vouchers, $Xmls) {
    $freeV = [System.Collections.Generic.List[object]]::new(); foreach ($v in $Vouchers) { $freeV.Add($v) }
    $freeX = [System.Collections.Generic.List[object]]::new(); foreach ($x in $Xmls) { $freeX.Add($x) }
    $pairs = [System.Collections.Generic.List[object]]::new()
    $take = { param($v, $x, [string]$by) $pairs.Add([pscustomobject]@{ V = $v; X = $x; By = $by }); [void]$freeV.Remove($v); [void]$freeX.Remove($x) }
    # 1. Ký hiệu + Số HĐ trên phiếu (ký hiệu trống/lệch → chỉ Số HĐ, nhiều XML cùng số → ưu tiên cùng ngày + cùng tiền)
    foreach ($v in @($freeV)) {
        if ($null -eq $v.Number) { continue }
        $c = @($freeX | Where-Object { $_.Number -eq $v.Number -and (Test-Symbol $v.Symbol $_) })
        $by = 'Ký hiệu + Số HĐ'
        if (-not $c.Count) { $c = @($freeX | Where-Object { $_.Number -eq $v.Number }); $by = 'Số HĐ (ký hiệu lệch)' }
        if ($c.Count -gt 1) { $c = @($c | Where-Object { $_.Date -eq $v.Date -and [Math]::Abs($_.Goods - $v.Goods) -le 1 }) }
        if ($c.Count -eq 1) { & $take $v $c[0] $by }
    }
    # 2. cùng ngày + tiền hàng + thuế + số dòng; nhiều phiếu giống hệt nhau → ghép theo thứ tự (nội dung như nhau)
    $sig = { param($d, $g, $t, $n) "$(if ($d) { Fmt-Date $d })|$g|$t|$n" }
    $byX = @{}
    foreach ($x in $freeX) { $k = & $sig $x.Date $x.Goods $x.Vat (Get-XmlLines $x).Count; if (-not $byX[$k]) { $byX[$k] = [System.Collections.Generic.List[object]]::new() }; $byX[$k].Add($x) }
    foreach ($v in @($freeV | Sort-Object { $_.SoCt })) {
        if (-not $v.Date) { continue }
        $k = & $sig $v.Date $v.Goods $v.Vat $v.Lines.Count
        $c = $byX[$k]
        if (-not $c -or -not $c.Count) { continue }
        $x = @($c | Sort-Object Number)[0]
        [void]$c.Remove($x)
        & $take $v $x 'Ngày + tiền + số dòng'
    }
    # 3. cùng ngày + tiền hàng (±1) — số dòng / thuế có thể lệch → lỗi dòng sẽ hiện
    foreach ($v in @($freeV | Sort-Object { $_.SoCt })) {
        $c = @($freeX | Where-Object { $_.Date -eq $v.Date -and [Math]::Abs($_.Goods - $v.Goods) -le 1 })
        if ($c.Count -eq 1) { & $take $v $c[0] 'Ngày + tiền hàng' }
    }
    # 4. cùng ngày + đúng 1 phiếu / 1 XML cùng tên khách (không phải khách lẻ) → tiền lệch
    foreach ($v in @($freeV)) {
        $nv = Normalize-Name $v.Name
        if (-not $nv -or $nv -match 'NGUOI TIEU DUNG|KHACH LE') { continue }
        $c = @($freeX | Where-Object { $_.Date -eq $v.Date -and (Normalize-Name $_.BuyerName) -eq $nv })
        $cv = @($freeV | Where-Object { $_.Date -eq $v.Date -and (Normalize-Name $_.Name) -eq $nv })
        if ($c.Count -eq 1 -and $cv.Count -eq 1) { & $take $v $c[0] 'Ngày + tên khách (tiền lệch)' }
    }
    return @{ Pairs = $pairs; FreeV = $freeV; FreeX = $freeX }
}

# ---------- Đầu phiếu ----------
# TK Ghi nợ theo Phương thức TT trên XML: Chuyển khoản → 131, Tiền mặt → 111 (VietDA dùng TK chi tiết 1111 cũng đúng)
function Get-PayKind([string]$Pay) {
    $n = Normalize-Name $Pay
    if ($n -match 'CHUYEN KHOAN|^CK$') { return 'CK' }
    if ($n -match 'TIEN MAT|^TM$') { return 'TM' }
    return ''
}
function Get-Tk([string]$Pay) { switch (Get-PayKind $Pay) { 'CK' { "131 / $TkCoOk" } 'TM' { "111 / $TkCoOk" } default { '' } } }
function Test-TkNo([string]$Tk, [string]$Kind) { switch ($Kind) { 'CK' { $Tk -eq '131' } 'TM' { $Tk -match '^111' } default { $true } } }
# Ký hiệu trên phiếu: kế toán ghi KHHDon (vd C26MFD, số mẫu "1" nằm ô Mã|Mẫu HĐ — ảnh kế toán 10/11/2026); phiếu cũ có thể ghi 1C26MFD → đều đúng
function Test-Symbol([string]$S, $X) { $S -and ($S -eq $X.Kh -or $S -eq $X.Symbol) }

# Ô đầu phiếu cần sửa — rỗng = đầu phiếu đúng. Field = nhãn trên phiếu, To = giá trị đúng, Auto = tool -Fix sửa được.
# Không kiểm ô "Hiển thị thuế suất từng mặt hàng": VietDA KHÔNG lưu ô này theo phiếu (tick tay + Lưu, mở lại vẫn mất — user thử 10/11/2026).
function Get-HeaderFixes($V, $X) {
    $list = [System.Collections.Generic.List[object]]::new()
    $add = { param($f, $from, $to, $text, $auto = $true, $xlab = 'XML') $list.Add([pscustomobject]@{ Field = $f; From = $from; To = $to; Text = $text; Auto = $auto; XLabel = $xlab }) }
    if ((Normalize-Name $V.Reason) -ne (Normalize-Name $ReasonOk)) { & $add 'Lý do' $V.Reason $ReasonOk "Lý do '$($V.Reason)' → '$ReasonOk'" $true 'Đúng' }
    if (-not (Test-Symbol $V.Symbol $X)) { & $add 'Ký hiệu' $V.Symbol $X.Kh "Ký hiệu '$($V.Symbol)' → $($X.Kh)" }
    if ($V.Number -ne $X.Number) { & $add 'Số hóa đơn' $V.SoHd ([string]$X.Number) "Số HĐ '$($V.SoHd)' → $($X.Number)" }
    $kind = Get-PayKind $X.Pay
    if ($kind -and (Get-PayKind $V.Pay) -ne $kind) { & $add 'Phương thức TT' $V.Pay $X.Pay "Phương thức TT '$($V.Pay)' → $kind" }
    if (-not (Test-TkNo $V.TkNo $kind)) { $to = if ($kind -eq 'CK') { '131' } else { '1111' }; & $add 'Ghi nợ' $V.TkNo $to "Ghi nợ '$($V.TkNo)' → $to" $true "Đúng ($(if ($kind -eq 'CK') { 'chuyển khoản' } else { 'tiền mặt' }))" }
    if ($V.TkCo -ne $TkCoOk) { & $add 'Ghi có' $V.TkCo $TkCoOk "Ghi có '$($V.TkCo)' → $TkCoOk" $true 'Đúng' }
    # Làm tròn (user 14/11/2026): VietDA tính thuế từng dòng rồi cộng → lệch XML 1–2 đ (tổng 19.999 / 20.001). Sửa ô "Tiền thuế" đầu phiếu
    # = tổng thuế XML; VietDA tự dồn phần lệch vào 1 dòng hàng (đo data test 14/11/2026). Ô Tiền VAT trên dòng KHÔNG sửa được (VietDA tính lại).
    # Tiền hàng phải khớp XML; lệch lớn hơn $RoundAdjMax đ = sai thật (dòng hàng) → chỉ báo.
    if ($null -ne $V.HVat -and $null -ne $X.Vat -and $V.HVat -ne $X.Vat -and $V.HGoods -eq $X.Goods) {
        $dv = [long]$X.Vat - [long]$V.HVat
        if ([Math]::Abs($dv) -le $RoundAdjMax) { & $add 'Tiền thuế' $V.HVat ([string]$X.Vat) "Tiền thuế $($V.HVat) → $($X.Vat) (làm tròn theo XML, tổng $($V.HGoods + $X.Vat))" }
        else { & $add 'Tiền thuế' $V.HVat ([string]$X.Vat) "Tiền thuế $($V.HVat) ≠ XML $($X.Vat) (lệch $dv đ — kiểm dòng hàng, sửa tay)" $false }
    }
    if ($V.HasInvoice -eq $false) { & $add 'Tick Hóa đơn' 'chưa tick' 'phải tick (sửa tay)' "tick 'Hóa đơn' (sửa tay)" $false 'Đúng' }
    # Theo 2 phiếu mẫu kế toán 13/11/2026: cột "Số hóa đơn" mọi dòng hàng = Số HĐ (VietDA tự điền — chỉ báo); Thanh toán theo PTTT (dưới)
    $lines = @($V.Lines)
    if ($lines.Count -and $lines[0].PSObject.Properties['InvNo']) {
        $badInv = @($lines | Where-Object { $null -ne $_.InvNo -and ("$($_.InvNo)" -replace '^0+', '') -ne [string]$X.Number })
        if ($badInv.Count) {
            $seenInv = (@($badInv | ForEach-Object { if ($_.InvNo) { $_.InvNo } else { 'trống' } } | Select-Object -Unique) -join ', ')
            & $add 'Số hóa đơn dòng hàng' "$seenInv ($($badInv.Count)/$($lines.Count) dòng)" ([string]$X.Number) "Số HĐ ở $($badInv.Count)/$($lines.Count) dòng hàng '$seenInv' → $($X.Number) (VietDA tự điền khi sửa Số HĐ đầu phiếu; còn sai thì sửa tay)" $false
        }
    }
    # Thanh toán KHÔNG gõ tay được (VietDA báo "Dữ liệu không thay đổi" — 14/11/2026): tiền mặt = nút "Thu tiền" (tạo phiếu thu, Thanh toán = tổng);
    # chuyển khoản mà đã có Thanh toán = đã có phiếu thu → chỉ báo, sửa tay (xóa phiếu thu sai)
    if ($V.PSObject.Properties['Paid'] -and $null -ne $V.Paid -and $kind) {
        $total = if ($V.InvTotal) { [long]$V.InvTotal } else { $V.Goods + $V.Vat }
        if ($kind -eq 'TM' -and [long]$V.Paid -lt $total - 1) {
            & $add 'Thu tiền' $V.Paid ([string]$total) "Thanh toán '$($V.Paid)' → bấm Thu tiền (phiếu thu $total)" $true 'Đúng (tiền mặt: Thu tiền → Thanh toán = Tổng hóa đơn, Còn nợ 0)'
        } elseif ($kind -eq 'TM' -and [long]$V.Paid -gt $total + 1) {
            & $add 'Thanh toán' $V.Paid ([string]$total) "Thanh toán '$($V.Paid)' > tổng $total — thu thừa, sửa tay phiếu thu" $false 'Đúng (tiền mặt: = Tổng hóa đơn)'
        } elseif ($kind -eq 'CK' -and [long]$V.Paid -gt 1) {
            & $add 'Thanh toán' $V.Paid '0' "Thanh toán '$($V.Paid)' → 0 (chuyển khoản không có phiếu thu tiền mặt; sửa tay)" $false 'Đúng (chuyển khoản: 0, Còn nợ = Tổng hóa đơn)'
        }
    }
    return , $list
}

# ---------- So 1 cặp phiếu ↔ XML ----------
function Compare-Pair($V, $X, $Cat, $Issues) {
    $add = {
        param([string]$Level, [string]$What, $xl, $vl, [string]$Hint = '', [string]$F = '', $VV = $null, $XV = $null, [string]$XLab = 'XML')
        $Issues.Add([pscustomobject]@{
            Number = [string]$X.Number; Date = Fmt-Date $X.Date; SoCt = $V.SoCt
            Line = $(if ($vl) { $vl.No } elseif ($xl) { "XML $($xl.Stt)" } else { '' })
            Level = $Level; What = $What
            XCode = $(if ($xl) { $xl.Code }); VCode = $(if ($vl) { $vl.Code })
            XName = $(if ($xl) { $xl.Name }); VName = $(if ($vl) { $vl.Item }); XUnit = $(if ($xl) { $xl.Unit })
            XQty = $(if ($xl) { $xl.Qty }); VQty = $(if ($vl) { $vl.Qty })
            XGoods = $(if ($xl) { $xl.Goods }); VGoods = $(if ($vl) { $vl.Goods })
            XVat = $(if ($xl) { $xl.ExpVat }); VVat = $(if ($vl) { $vl.Vat })
            VCost = $(if ($vl -and $null -ne $vl.Cost) { Round-Money $vl.Cost })
            VTk = $(if ($vl) { "$($vl.TkNo)/$($vl.TkCo) GV $($vl.NoGv)/$($vl.CoGv)" })
            Hint = $Hint; Field = $F; VVal = $VV; XVal = $XV; XLabel = $XLab
        })
    }
    $xs = @(Get-XmlLines $X)
    foreach ($xl in $xs) { $xl | Add-Member -Force ExpVat ($(if ($null -ne $xl.Rate) { Round-Money ($xl.Goods * $xl.Rate / 100) } else { $null })) }
    # ghép dòng: cùng số dòng → theo thứ tự; khác → cùng mã + tiền, rồi cùng tiền
    $pairs = [System.Collections.Generic.List[object]]::new()
    $vs = @($V.Lines)
    if ($vs.Count -eq $xs.Count) { for ($i = 0; $i -lt $xs.Count; $i++) { $pairs.Add(@($xs[$i], $vs[$i])) } }
    else {
        $restV = [System.Collections.Generic.List[object]]::new(); foreach ($l in $vs) { $restV.Add($l) }
        $restX = [System.Collections.Generic.List[object]]::new()
        foreach ($xl in $xs) {
            $hit = @($restV | Where-Object { $_.Code -eq $xl.Code -and [Math]::Abs($_.Goods - $xl.Goods) -le 1 }) | Select-Object -First 1
            if ($hit) { $pairs.Add(@($xl, $hit)); [void]$restV.Remove($hit) } else { $restX.Add($xl) }
        }
        foreach ($xl in @($restX)) {
            $hit = @($restV | Where-Object { [Math]::Abs($_.Goods - $xl.Goods) -le 1 }) | Select-Object -First 1
            if ($hit) { $pairs.Add(@($xl, $hit)); [void]$restV.Remove($hit); [void]$restX.Remove($xl) }
        }
        foreach ($xl in $restX) { & $add 'Lỗi' 'Thiếu dòng trên VietDA' $xl $null 'Thêm dòng này vào phiếu' }
        foreach ($vl in $restV) { & $add 'Lỗi' 'Thừa dòng (không có trong XML)' $null $vl 'Xóa dòng này / kiểm lại HĐ' }
    }
    $kind = Get-PayKind $X.Pay
    # tổng thanh toán (hàng + thuế) phải đúng XML. Kế toán chốt 14/11/2026: tổng lệch làm tròn → CHỈNH TIỀN THUẾ VAT, KHÔNG sửa tiền hàng (-Fix tự sửa ô Tiền thuế đầu phiếu)
    $xPay = if ($null -ne $X.Total) { Round-Money $X.Total } else { $X.Goods + $X.Vat }
    $vPay = $V.Goods + $V.Vat
    $payOk = $vPay -eq $xPay
    foreach ($pr in $pairs) {
        $xl = $pr[0]; $vl = $pr[1]
        $isKm = $xl.TChat -eq '2' -or ($xl.Goods -eq 0 -and $xl.Qty -gt 0)
        # tiền
        $zero = $vl.Goods -eq 0 -and $xl.Goods -ne 0
        $dG = [Math]::Abs($vl.Goods - $xl.Goods)
        if ($zero) { & $add 'Lỗi' 'Dòng 0 đ' $xl $vl "Tiền hàng phải là $($xl.Goods), thuế $($xl.RateText)" 'Tiền hàng' $vl.Goods $xl.Goods }
        elseif ($dG -gt $RoundAdjMax) { & $add 'Lỗi' 'Tiền hàng lệch XML' $xl $vl '' 'Tiền hàng' $vl.Goods $xl.Goods }
        elseif ($dG -gt 1 -and -not $payOk) { & $add 'Cảnh báo' "Tiền hàng lệch XML $($vl.Goods - $xl.Goods) đ (chỉnh làm tròn?)" $xl $vl "Tổng thanh toán chưa khớp XML — xem dòng 'Tổng thanh toán lệch'" 'Tiền hàng' $vl.Goods $xl.Goods }
        if (-not $zero -and $null -ne $xl.ExpVat -and [Math]::Abs($vl.Vat - $xl.ExpVat) -gt 1) {
            $vr = if ($vl.Goods) { [Math]::Round($vl.Vat * 100.0 / $vl.Goods, 1) } else { 0 }
            & $add 'Lỗi' 'Thuế suất / tiền thuế sai' $xl $vl "XML $($xl.RateText), VietDA ≈ $vr% (lệch làm tròn: chỉnh Tiền thuế, không sửa tiền hàng)" 'Tiền thuế' "$($vl.Vat) (≈ $vr%)" "$($xl.ExpVat) ($($xl.RateText))"
        }
        # cột Loại thuế từng dòng (chỉ có khi đã tick "Hiển thị thuế suất từng mặt hàng")
        if ($vl.Rate -and $null -ne $xl.Rate) {
            $vRate = if ($vl.Rate -match '^\s*(\d+(?:[.,]\d+)?)') { [double]::Parse(($Matches[1] -replace ',', '.'), $Inv) } elseif ($vl.Rate -match '(?i)KCT|KKKNT') { 0.0 } else { $null }
            if ($null -ne $vRate -and [Math]::Abs($vRate - $xl.Rate) -gt 0.001) { & $add 'Lỗi' "Loại thuế dòng $($vl.Rate) ≠ XML $($xl.RateText)" $xl $vl '' 'Loại thuế' $vl.Rate $xl.RateText }
        }
        # SL (chỉ đúng nghĩa khi XML là bản quy đổi — đúng bản đã Hội nhập)
        $lvl = if ($X.Converted) { 'Lỗi' } else { 'Cảnh báo' }
        if ($null -ne $xl.Qty -and $null -ne $vl.Qty -and [Math]::Abs($vl.Qty - $xl.Qty) -gt 0.0005) { & $add $lvl 'Số lượng lệch XML' $xl $vl $(if (-not $X.Converted) { 'XML gốc chưa quy đổi ĐVT' }) 'Số lượng' $vl.Qty $xl.Qty }
        # mã hàng: phiếu ↔ XML quy đổi ↔ danh mục
        $xCat = if ($Cat -and $xl.Code) { $Cat.ByCode[$xl.Code.ToUpperInvariant()] } else { $null }
        $vCat = if ($Cat -and $vl.Code) { $Cat.ByCode[$vl.Code.ToUpperInvariant()] } else { $null }
        $codeOk = $xl.Code -match '^(?i)(HH|KM)'
        if ($X.Converted -and -not $codeOk) {
            & $add 'Lỗi' "XML còn mã KiotViet ($($xl.Code))" $xl $vl 'Gán mã HH/KM ở trang Đối soát hóa đơn (bảng mã Vietda) rồi tải lại XML quy đổi' 'Mã hàng' $vl.Code $xl.Code
        } elseif ($X.Converted -and $vl.Code -ne $xl.Code) {
            & $add 'Lỗi' "Mã hàng VietDA $($vl.Code) ≠ XML $($xl.Code)" $xl $vl $(if ($xCat) { "Đổi sang $($xCat.Code) — $($xCat.Name)" } elseif ($Cat) { "Mã $($xl.Code) chưa có trong danh mục — import danh mục Vật tư hàng hóa trước" } else { '' }) 'Mã hàng' $vl.Code $xl.Code
        } elseif ($Cat -and -not $vCat) {
            & $add 'Lỗi' "Mã $($vl.Code) chưa có trong danh mục VietDA" $xl $vl 'Import danh mục Vật tư hàng hóa (mã mới) vào VietDA rồi sửa dòng này'
        }
        if ($xCat -and $xl.Unit -and $xCat.Unit -and (Norm-Unit $xl.Unit) -ne (Norm-Unit $xCat.Unit)) { & $add 'Cảnh báo' "ĐVT XML '$($xl.Unit)' ≠ ĐVT danh mục '$($xCat.Unit)'" $xl $vl 'Kiểm hệ số quy đổi của mã này' }
        if ($isKm -and $X.Converted -and $codeOk -and $xl.Code -notmatch '^(?i)KM') { & $add 'Lỗi' 'Hàng khuyến mãi nhưng mã không phải KM' $xl $vl 'Gán mã KM… cho hàng KM ở bảng mã Vietda' }
        # tài khoản dòng
        $tkWant = if ($kind -eq 'CK') { '131' } elseif ($kind -eq 'TM') { '111x' } else { '' }
        if ($tkWant -and -not (Test-TkNo $vl.TkNo $kind)) { & $add 'Cảnh báo' "TK Nợ dòng $($vl.TkNo) (đúng: $tkWant)" $xl $vl 'Sửa Ghi nợ đầu phiếu rồi kiểm lại TK Nợ từng dòng' 'TK Nợ dòng' $vl.TkNo $tkWant 'Đúng' }
        if ($vl.TkCo -notmatch '^511') { & $add 'Cảnh báo' "TK Có dòng $($vl.TkCo) (thường 511x)" $xl $vl '' 'TK Có dòng' $vl.TkCo '511x' 'Đúng' }
        if (($vl.NoGv -and $vl.NoGv -notmatch '^632') -or ($vl.CoGv -and $vl.CoGv -notmatch '^15[56]')) { & $add 'Cảnh báo' "TK giá vốn $($vl.NoGv)/$($vl.CoGv) (thường 632/156x)" $xl $vl '' 'TK giá vốn' "$($vl.NoGv)/$($vl.CoGv)" '632/156x' 'Đúng' }
        if ($null -ne $vl.Cost -and $vl.Qty -gt 0 -and (Round-Money $vl.Cost) -eq 0) { & $add 'Cảnh báo' 'Giá vốn 0' $xl $vl 'Kiểm tồn kho / nhập kho mã này trên VietDA' }
    }
    # tổng
    if (-not $payOk) {
        $d = $xPay - $vPay
        & $add 'Lỗi' "Tổng thanh toán (hàng + thuế) lệch: VietDA $vPay / XML $xPay" $null $null "Chỉnh Tiền thuế $(if ($d -gt 0) { '+' })$d đ (ô Tiền thuế đầu phiếu, KHÔNG sửa tiền hàng) cho tổng = $xPay — -Fix tự làm khi tiền hàng khớp XML" 'Tổng thanh toán' $vPay $xPay
    }
    if ([Math]::Abs($V.Goods - $X.Goods) -gt $RoundAdjMax) { & $add 'Lỗi' "Tổng tiền hàng lệch: VietDA $($V.Goods) / XML $($X.Goods)" $null $null '' 'Tổng tiền hàng' $V.Goods $X.Goods }
    if ([Math]::Abs($V.Vat - $X.Vat) -gt 2) { & $add 'Lỗi' "Tổng thuế lệch: VietDA $($V.Vat) / XML $($X.Vat)" $null $null '' 'Tổng thuế' $V.Vat $X.Vat }
    if ($X.Discount -and [Math]::Abs($V.Disc - $X.Discount) -gt 1) { & $add 'Lỗi' "Chiết khấu lệch: VietDA $($V.Disc) / XML $($X.Discount)" $null $null '' 'Chiết khấu' $V.Disc $X.Discount }
    if (@($X.Lines | Where-Object { $_.TChat -eq '3' }).Count -and -not $X.Discount) { & $add 'Cảnh báo' 'XML có dòng chiết khấu thương mại — kiểm tay' $null $null '' }
    if ($V.Date -and $V.Date -ne $X.Date) { & $add 'Cảnh báo' "Ngày HĐ trên phiếu $(Fmt-Date $V.Date) ≠ XML $(Fmt-Date $X.Date)" $null $null '' 'Ngày HĐ' (Fmt-Date $V.Date) (Fmt-Date $X.Date) }
    if ($X.BuyerMst -and $V.Mst -and ($V.Mst -replace '\D', '') -ne ($X.BuyerMst -replace '\D', '')) { & $add 'Cảnh báo' "MST phiếu $($V.Mst) ≠ MST người mua XML $($X.BuyerMst)" $null $null 'Kiểm Đối tượng trên phiếu' 'MST' $V.Mst $X.BuyerMst }
}

# ---------- Báo cáo .xlsx nhiều sheet (OOXML tối giản như Write-XlsxReport của tool sao kê) ----------
# style: 0 thường · 1 tiêu đề · 2 #,##0 · 3 xanh lá · 4 đỏ · 5 #,##0.### · 6 vàng · 7 xuống dòng trong ô
function Write-XlsxBook([string]$Path, $Sheets) {
    $esc = { param($s) [Security.SecurityElement]::Escape(([string]$s -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', '')) }
    # cột > Z (AA, AB…): chia nguyên bằng [int] — [Math]::Floor(int) chọn overload Decimal → [char] lỗi "Invalid cast from Decimal"
    $colName = { param($i) $s = ''; for ([int]$n = $i + 1; $n -gt 0; $n = [int][Math]::Floor([double]($n - 1) / 26)) { $s = [string][char][int](65 + (($n - 1) % 26)) + $s }; $s }
    $cellXml = {
        param($ref, $val, [int]$style)
        if ($null -eq $val -or [string]$val -eq '') { return '' }
        if ($val -is [long] -or $val -is [int] -or $val -is [double]) { return "<c r=`"$ref`" s=`"$style`"><v>$([Convert]::ToString($val, $Inv))</v></c>" }
        '<c r="' + $ref + '" t="inlineStr"' + $(if ($style) { ' s="' + $style + '"' } else { '' }) + '><is><t xml:space="preserve">' + (& $esc $val) + '</t></is></c>'
    }
    $parts = [ordered]@{}
    $sheetList = ''; $rels = ''; $types = ''
    $n = 0
    foreach ($sh in $Sheets) {
        $n++
        $cols = $sh.Cols
        $sb = New-Object Text.StringBuilder
        [void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')
        [void]$sb.Append('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>')
        for ($c = 0; $c -lt $cols.Count; $c++) {
            $p = $cols[$c][1]; $wd = ([string]$cols[$c][0]).Length + 2
            foreach ($r in $sh.Rows | Select-Object -First 2000) { $l = ([string]$r.$p).Length + 2; if ($l -gt $wd) { $wd = $l } }
            [void]$sb.Append("<col min=`"$($c + 1)`" max=`"$($c + 1)`" width=`"$([Math]::Min(60, [Math]::Max(8, $wd)))`" customWidth=`"1`"/>")
        }
        [void]$sb.Append('</cols><sheetData><row r="1">')
        for ($c = 0; $c -lt $cols.Count; $c++) { [void]$sb.Append((& $cellXml "$(& $colName $c)1" $cols[$c][0] 1)) }
        [void]$sb.Append('</row>')
        $i = 1
        foreach ($r in $sh.Rows) {
            $i++
            [void]$sb.Append("<row r=`"$i`">")
            for ($c = 0; $c -lt $cols.Count; $c++) {
                $p = $cols[$c][1]; $val = $r.$p; $style = 0
                if ($val -is [long] -or $val -is [int]) { $style = 2 } elseif ($val -is [double]) { $style = 5 }
                if ($sh.Color -and $sh.Color.ContainsKey($p) -and [string]$val) { $style = & $sh.Color[$p] ([string]$val) }
                [void]$sb.Append((& $cellXml "$(& $colName $c)$i" $val $style))
            }
            [void]$sb.Append('</row>')
        }
        [void]$sb.Append("</sheetData><autoFilter ref=`"A1:$(& $colName ($cols.Count - 1))$i`"/></worksheet>")
        $parts["xl/worksheets/sheet$n.xml"] = $sb.ToString()
        $sheetList += "<sheet name=`"$(& $esc $sh.Name)`" sheetId=`"$n`" r:id=`"rId$n`"/>"
        $rels += "<Relationship Id=`"rId$n`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet`" Target=`"worksheets/sheet$n.xml`"/>"
        $types += "<Override PartName=`"/xl/worksheets/sheet$n.xml`" ContentType=`"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml`"/>"
    }
    $parts['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + $types + '</Types>'
    $parts['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    $parts['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + $sheetList + '</sheets></workbook>'
    $parts['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + $rels + "<Relationship Id=`"rId$($n + 1)`" Type=`"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles`" Target=`"styles.xml`"/></Relationships>"
    $parts['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.###"/></numFmts><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF006100"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF9C0006"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF9C5700"/><name val="Calibri"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
    $fs = [IO.File]::Open($Path, [IO.FileMode]::CreateNew)
    $zip = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $utf8 = New-Object Text.UTF8Encoding($false)
        foreach ($k in $parts.Keys) {
            $sw = New-Object IO.StreamWriter($zip.CreateEntry($k).Open(), $utf8)
            try { $sw.Write($parts[$k]) } finally { $sw.Dispose() }
        }
    } finally { $zip.Dispose(); $fs.Dispose() }
}

# ================= main =================
$startedAt = Get-Date
Write-Log INFO "===== Kiểm phiếu XH VietDA ↔ XML bán ra$(if ($FromForms) { " (từ phiếu đã đọc: $FromForms)" })"
if ($fontNote) { Write-Log WARN "$fontNote — tiếng Việt có thể hiện thành '?' (chuột phải thanh tiêu đề → Properties → Font → Consolas); file log vẫn đúng." }

$xmlDir = Find-SaleXmlFolder
Write-Log INFO "Thư mục XML: $xmlDir"
$xmls = Read-SaleXml $xmlDir
$cat = Read-Catalog

$parseD = { param($s, $what) $d = [datetime]::MinValue; if (-not [datetime]::TryParseExact($s, 'dd/MM/yyyy', $Inv, 'None', [ref]$d)) { Fail "$what '$s' phải dạng dd/MM/yyyy" }; $d }
$fromD = if ($From) { & $parseD $From '-From' } else { @($xmls | Sort-Object Date)[0].Date }
$toD = if ($To) { & $parseD $To '-To' } else { @($xmls | Sort-Object Date -Descending)[0].Date }
$inRange = @($xmls | Where-Object { $_.Date -ge $fromD -and $_.Date -le $toD })
if ($inRange.Count -lt $xmls.Count) { Write-Log INFO "Bỏ $($xmls.Count - $inRange.Count) XML ngoài khoảng $(Fmt-Date $fromD) → $(Fmt-Date $toD)" }
if (-not $inRange.Count) { Fail "Không có XML bán ra nào từ $(Fmt-Date $fromD) đến $(Fmt-Date $toD)" }
Write-Log INFO "Khoảng ngày: $(Fmt-Date $fromD) → $(Fmt-Date $toD), $($inRange.Count) HĐ"

if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
if ($FromForms) {
    if (-not (Test-Path -LiteralPath $FromForms -PathType Leaf)) { Fail "Không có file -FromForms $FromForms" }
    $vouchers = Load-Vouchers $FromForms
    Write-Log INFO "Đọc $($vouchers.Count) phiếu từ $FromForms"
} else {
    $script:vda = Find-Vietda
    if (-not $script:vda) { Fail 'Không thấy VietDA đã đăng nhập (Menu.exe) — mở VietDA, đăng nhập rồi chạy lại.' }
    if ([Vdb]::Dialogs($script:vda.Pid).Count) { Fail 'VietDA đang mở hộp thoại — đóng nó rồi chạy lại.' }
    Write-Log WARN 'Tool sẽ mở Nhập xuất > Tìm kiếm chứng từ (cần chuột ~5 giây — KHÔNG đụng chuột/bàn phím), rồi đọc từng phiếu.'
    if ($Fix) {
        Write-Log WARN "-Fix: tool sẽ SỬA + LƯU đầu phiếu trên VietDA (Lý do '$ReasonOk', Ký hiệu, Số HĐ, Phương thức TT, Ghi nợ 131/1111, Ghi có $TkCoOk, Tiền thuế lệch làm tròn theo XML; hỏi 'điền tự động TK dòng hàng' → Yes), XÓA hết 'Nhiều hóa đơn', tiền mặt → bấm 'Thu tiền' (tạo phiếu thu). Dòng hàng KHÔNG sửa."
        if (-not $Yes) {
            Write-Host ''
            $ans = Read-Host 'Gõ Y rồi Enter để cho phép tool SỬA + LƯU phiếu trên VietDA (khác Y = thoát)'
            if ($ans -notmatch '^\s*[Yy]\s*$') { Write-Log INFO 'Không đồng ý sửa → thoát, không làm gì.'; exit 0 }
        }
        Write-Log INFO 'Đồng ý sửa + Lưu.'
    }
    $vouchers = [System.Collections.Generic.List[object]]::new()
    $readErr = $null
    try { $vouchers = Read-AllVouchers (Fmt-Date $fromD) (Fmt-Date $toD) $inRange }
    catch { $readErr = "$($_.Exception.Message) (dòng $($_.InvocationInfo.ScriptLineNumber))" }
    if ($readErr) { Fail "Đọc phiếu VietDA lỗi: $readErr" }
    $json = Join-Path $OutDir 'phieu-vietda.json'
    Save-Vouchers $json $vouchers
    Write-Log INFO "Đã lưu $($vouchers.Count) phiếu → $json (chạy lại phần so sánh: -FromForms `"$json`")"
    if (-not $vouchers.Count) { Write-Log WARN 'VietDA không có phiếu XH nào trong khoảng ngày → mọi HĐ đều "Chưa nhập VietDA"' }
}
$m = Match-All $vouchers $inRange
Write-Log INFO "Ghép: $($m.Pairs.Count) cặp, $($m.FreeX.Count) HĐ chưa có phiếu, $($m.FreeV.Count) phiếu không có XML"

$issues = [System.Collections.Generic.List[object]]::new()
$rows = [System.Collections.Generic.List[object]]::new()
$newRow = {
    param($x, $v)
    [pscustomobject]@{
        Date = $(if ($x) { Fmt-Date $x.Date } elseif ($v.Date) { Fmt-Date $v.Date }); Symbol = $(if ($x) { $x.Symbol }); Number = $(if ($x) { [string]$x.Number })
        Buyer = $(if ($x) { $x.BuyerName } else { $v.Name }); Mst = $(if ($x) { $x.BuyerMst }); Pay = $(if ($x) { $x.Pay }); Tk = $(if ($x) { Get-Tk $x.Pay })
        XGoods = $(if ($x) { $x.Goods }); XVat = $(if ($x) { $x.Vat })
        SoCt = $(if ($v) { $v.SoCt }); Reason = $(if ($v) { $v.Reason }); VSymbol = $(if ($v) { $v.Symbol }); VNumber = $(if ($v) { [string]$v.SoHd })
        VPay = $(if ($v) { $v.Pay }); VTk = $(if ($v) { "$($v.TkNo) / $($v.TkCo)" }); Fixed = $(if ($v -and $v.PSObject.Properties['Fixed']) { $v.Fixed }); FixError = $(if ($v -and $v.PSObject.Properties['FixError']) { $v.FixError })
        VGoods = $(if ($v) { $v.Goods }); VVat = $(if ($v) { $v.Vat }); By = ''
        Result = ''; Compare = ''; LineErr = 0; Warn = 0; Note = $(if ($v -and $v.PSObject.Properties['Note']) { $v.Note } else { '' }); File = $(if ($x) { $x.File })
    }
}
$pairByX = @{}; foreach ($p in $m.Pairs) { $pairByX[$p.X] = $p }
foreach ($x in ($inRange | Sort-Object Date, Number)) {
    $p = $pairByX[$x]
    if (-not $p) { $row = & $newRow $x $null; $row.Result = 'Chưa nhập VietDA'; $row.Compare = "VietDA: không có phiếu | XML: HĐ $($x.Kh) số $($x.Number)"; $rows.Add($row); continue }
    $v = $p.V
    $row = & $newRow $x $v
    $row.By = $p.By
    $before = $issues.Count
    Compare-Pair $v $x $cat $issues
    $mine = @($issues | Select-Object -Skip $before)
    $row.LineErr = @($mine | Where-Object Level -eq 'Lỗi').Count
    $row.Warn = @($mine | Where-Object Level -eq 'Cảnh báo').Count
    $hfix = Get-HeaderFixes $v $x
    $row | Add-Member -Force HFixAuto (@($hfix | Where-Object { $_.Auto }).Count)
    if (-not $row.Tk) { $row.Note = (@($row.Note, "Phương thức TT XML '$($x.Pay)' lạ — tự chọn TK Ghi nợ") | Where-Object { $_ }) -join '; ' }
    # 1 cột "So với XML": mỗi chỗ lệch 1 dòng trong ô — "VietDA: Ký hiệu '1C26MMQ' | XML: Ký hiệu 'C26TMV'" (user yêu cầu 10/11/2026)
    $cmp = [System.Collections.Generic.List[string]]::new()
    foreach ($h in $hfix) { $cmp.Add("VietDA: $($h.Field) '$($h.From)' | $($h.XLabel): $($h.Field) '$($h.To)'") }
    foreach ($i in $mine) {
        $code = @($i.VCode, $i.XCode | Where-Object { $_ }) | Select-Object -First 1
        $at = if ("$($i.Line)" -match '^XML') { "$($i.Line)$(if ($code) { " ($code)" }): " } elseif ($i.Line) { "Dòng $($i.Line)$(if ($code) { " ($code)" }): " } else { '' }
        $warn = if ($i.Level -eq 'Cảnh báo') { ' (cảnh báo)' } else { '' }
        if ($i.Field) { $cmp.Add("$at" + "VietDA: $($i.Field) '$($i.VVal)' | $($i.XLabel): $($i.Field) '$($i.XVal)'$warn") }
        else { $cmp.Add("$at$($i.What)$(if ($i.Hint) { " → $($i.Hint)" })$warn") }
    }
    $row.Compare = if ($cmp.Count) { $cmp -join "`n" } else { 'Khớp XML' }    $row.Result = if ($row.FixError) { 'Sửa lỗi' } elseif ($row.LineErr) { 'Lỗi dòng' } elseif ($hfix.Count) { 'Cần sửa đầu phiếu' } elseif ($row.Warn) { 'Cảnh báo' } else { 'OK' }
    $rows.Add($row)
}
foreach ($v in $m.FreeV) {
    $row = & $newRow $null $v
    $row.Result = 'Phiếu không có XML'
    $row.Compare = "VietDA: phiếu $($v.SoCt) (Ký hiệu '$($v.Symbol)', Số HĐ '$($v.SoHd)') | XML: không có"
    $row.Note = (@($row.Note, 'Không ghép được với XML nào (thiếu XML / Số HĐ sai + tiền lệch / phiếu nhập tay)') | Where-Object { $_ }) -join '; '
    $rows.Add($row)
}

$resultColor = @{ Result = { param($s) switch -Regex ($s) { '^OK$' { 3 } '^(Cần sửa đầu phiếu|Cảnh báo)$' { 6 } default { 4 } } }; Fixed = { param($s) 3 }; Compare = { param($s) 7 } }
$levelColor = @{ Level = { param($s) if ($s -eq 'Cảnh báo') { 6 } else { 4 } } }
$sheets = @(
    @{ Name = 'Phieu'; Rows = $rows; Color = $resultColor; Cols = @(
        @('Ngày HĐ', 'Date'), @('Ký hiệu', 'Symbol'), @('Số HĐ', 'Number'), @('Người mua', 'Buyer'), @('MST', 'Mst'), @('Phương thức TT', 'Pay'),
        @('TK đúng (Nợ / Có)', 'Tk'), @('Tiền hàng XML', 'XGoods'), @('Thuế XML', 'XVat'), @('Số CT VietDA', 'SoCt'), @('Kết quả', 'Result'),
        @('So với XML', 'Compare'),
        @('Số lỗi', 'LineErr'), @('Số cảnh báo', 'Warn'),
        @('Lý do VietDA', 'Reason'), @('Ký hiệu VietDA', 'VSymbol'), @('Số HĐ VietDA', 'VNumber'), @('PTTT VietDA', 'VPay'), @('Ghi nợ / Ghi có VietDA', 'VTk'),
        @('Tool đã sửa + Lưu', 'Fixed'), @('Lỗi khi sửa', 'FixError'), @('Tiền hàng VietDA', 'VGoods'), @('Thuế VietDA', 'VVat'), @('Ghép theo', 'By'), @('Ghi chú', 'Note'), @('File XML', 'File')) }
    @{ Name = 'Loi-dong'; Rows = $issues; Color = $levelColor; Cols = @(
        @('Số HĐ', 'Number'), @('Ngày HĐ', 'Date'), @('Số CT', 'SoCt'), @('Dòng', 'Line'), @('Mức', 'Level'), @('Lỗi', 'What'),
        @('Mã XML', 'XCode'), @('Mã VietDA', 'VCode'), @('Tên XML', 'XName'), @('Tên VietDA', 'VName'), @('ĐVT XML', 'XUnit'),
        @('SL XML', 'XQty'), @('SL VietDA', 'VQty'), @('Tiền hàng XML', 'XGoods'), @('Tiền hàng VietDA', 'VGoods'),
        @('Thuế XML', 'XVat'), @('Thuế VietDA', 'VVat'), @('Tiền vốn VietDA', 'VCost'), @('TK VietDA (Nợ/Có, GV)', 'VTk'), @('Gợi ý', 'Hint')) }
)
$report = Join-Path $OutDir 'ket-qua-kiem-xh.xlsx'
try { Write-XlsxBook $report $sheets; Write-Log OK "Kết quả → $report" }
catch {
    Write-Log ERROR "Ghi $(Split-Path $report -Leaf) lỗi: $($_.Exception.Message) → ghi CSV"
    $rows | Export-Csv -LiteralPath (Join-Path $OutDir 'phieu.csv') -Delimiter ';' -NoTypeInformation -Encoding UTF8
    $issues | Export-Csv -LiteralPath (Join-Path $OutDir 'loi-dong.csv') -Delimiter ';' -NoTypeInformation -Encoding UTF8
}
$count = { param($r) @($rows | Where-Object Result -eq $r).Count }
$summary = [ordered]@{
    'Khoảng ngày' = "$(Fmt-Date $fromD) → $(Fmt-Date $toD)"
    'XML bán ra' = "$($inRange.Count) HĐ ($(@($inRange | Where-Object Converted).Count) bản quy đổi)"
    'Phiếu XH VietDA' = $vouchers.Count
    'Danh mục' = $(if ($cat) { "$($cat.File) ($($cat.ByCode.Count) mã)" } else { 'KHÔNG có — không kiểm mã theo danh mục' })
    'OK' = & $count 'OK'
    'Cần sửa đầu phiếu' = & $count 'Cần sửa đầu phiếu'
    'Lỗi dòng' = & $count 'Lỗi dòng'
    'Cảnh báo' = & $count 'Cảnh báo'
    'Chưa nhập VietDA' = & $count 'Chưa nhập VietDA'
    'Phiếu không có XML' = & $count 'Phiếu không có XML'
    # vietda-tools-ui.ps1 đọc dòng này để bật nút "Sửa" (> 0 = còn đầu phiếu tool -Fix sửa được)
    'Phiếu có đầu phiếu tool sửa được' = @($rows | Where-Object { $_.PSObject.Properties['HFixAuto'] -and $_.HFixAuto -gt 0 }).Count
    'Tool đã sửa + Lưu' =$(if ($Fix) { @($rows | Where-Object { $_.Fixed }).Count } else { 'không (chạy -Fix để sửa)' })
    'Sửa lỗi' = & $count 'Sửa lỗi'
    'Thời gian' = "$([int]((Get-Date) - $startedAt).TotalSeconds) giây"
}
@($summary.Keys | ForEach-Object { '{0}: {1}' -f $_, $summary[$_] }) | Set-Content -LiteralPath (Join-Path $OutDir 'tom-tat.txt') -Encoding UTF8
foreach ($k in $summary.Keys) { Write-Log $(if ($k -in 'Lỗi dòng', 'Chưa nhập VietDA', 'Phiếu không có XML' -and $summary[$k] -gt 0) { 'WARN' } else { 'INFO' }) "  $k`: $($summary[$k])" }
Write-Log OK '===== Xong'
if (-not $NoOpen) { Start-Process explorer.exe $OutDir }
