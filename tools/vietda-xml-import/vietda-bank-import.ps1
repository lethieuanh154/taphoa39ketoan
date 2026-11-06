<#
.SYNOPSIS
  Tự tạo phiếu thu/chi tiền gửi trên VietDA từ sao kê TPBank (.xlsx):
  - Ghi có  → Phiếu thu tiền gửi (báo có), lý do "Thu tiền bán hàng theo HD <số HĐĐT>" (số HĐĐT lấy từ Excel Đối soát CK
              doi-soat-ck_*.xlsx, sheet Nhap-VietDA; CSV doi-soat-ck_*.csv cũ vẫn nhận), đối tượng = người mua trong XML hóa đơn
              bán ra (không có MST → Khách lẻ).
  - Ghi nợ  → Phiếu chi tiền gửi (báo nợ), lý do "Chuyển trả tiền hàng theo HD <số HĐ>", đối tượng = MST đối tác theo Excel
              Đối soát CK (không có dòng Excel → cách cũ: "HD <số>" trong diễn giải sao kê + XML hóa đơn đầu vào).

.DESCRIPTION
  Mỗi lượt chạy làm 1 loại phiếu = loại phiếu đang mở ở tab chọn trên VietDA (mở Thu chi > Phiếu thu/chi tiền gửi).
  Grid "Chi tiết thu chi" chỉ nhận bàn phím → tool CHIẾM FOCUS VietDA, click + gõ phím như người.
  KHÔNG dùng chuột/bàn phím khi tool đang chạy; tool tự dừng nếu VietDA mất focus.

  Mỗi phiếu: (Thêm) → Ngày = ngày GD → Đối tượng → Lý do → Số tiền dòng 1 → kiểm Tổng thanh toán → Lưu.
  Chống tạo trùng theo Mã GD (sổ _vietda-ck-da-nhap.txt cạnh script), trừ khi -Force.
  Gặp hộp thoại hỏi (nhiều nút) hoặc thông báo lạ sau Lưu → DỪNG, để nguyên cho người dùng xử lý.

  Đối tượng: tool đọc danh mục bằng cách chọn lần lượt từng mã trong ô Đối tượng của phiếu đang mở (đọc tên).
  Người bán / người mua XML → mã: _vietda-map-mst.csv (MST;Mã, tự ghi tay) → mã = MST → tên trùng (bỏ dấu, hoa/thường).
  Thư mục XML chứa cả mua vào + bán ra (quét thư mục con); tool tách theo MST công ty (MST có trong nhiều XML nhất).

  Đầu vào: mọi sao kê *.xlsx + CSV Đối soát CK *.csv trong thư mục Input\ cạnh script (gộp lại); XML hóa đơn trong <tool>\xml (hoặc Input\xml): sold\ + purchase\, không hỏi chọn.
  Chạy xong: Output\<ngày-giờ>\ có ket-qua-chay.xlsx (từng GD: thành công / lỗi / bỏ qua + Đúng/Sai so với VietDA, tô xanh/đỏ)
  + tom-tat.txt. Đúng/Sai đọc từ bảng kê VietDA (Thu chi > Tìm kiếm chứng từ > Hiển thị > Excel), bảng kê không lưu lại.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -DryRun
  powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -XmlFolder D:\HoaDonXML\MuaVao -Limit 1
  powershell -ExecutionPolicy Bypass -File vietda-bank-import.ps1 -VerifyOnly
#>
param(
    [string]$Statement,
    [string]$Recon,
    [string]$XmlFolder,
    [ValidateSet('', 'Thu', 'Chi')][string]$Mode = '',
    [string]$RetailObject = 'KH010',
    [string]$WalkInObject = 'KH001',
    [string]$CompanyObject = 'CTY001',
    [switch]$DryRun,
    [switch]$VerifyOnly,
    [switch]$NoVerify,
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

# Workbook Excel của MỌI tiến trình Excel (VietDA tự mở Excel riêng, GetActiveObject có thể trả instance khác):
# cửa sổ EXCEL7 → AccessibleObjectFromWindow(OBJID_NATIVEOM) = đối tượng Window, .Parent = Workbook
if (-not ('VdXl' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class VdXl {
    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr h, uint id, ref Guid iid, [MarshalAs(UnmanagedType.IDispatch)] out object o);
    static string Cls(IntPtr h) { StringBuilder sb = new StringBuilder(64); GetClassName(h, sb, 64); return sb.ToString(); }
    public static object[] Windows() {
        List<IntPtr> tops = new List<IntPtr>();
        EnumWindows(delegate(IntPtr h, IntPtr l) { if (Cls(h) == "XLMAIN") tops.Add(h); return true; }, IntPtr.Zero);
        List<object> res = new List<object>();
        Guid iid = new Guid("00020400-0000-0000-C000-000000000046");
        foreach (IntPtr t in tops) {
            EnumChildWindows(t, delegate(IntPtr h, IntPtr l) {
                if (Cls(h) == "EXCEL7") { object o; if (AccessibleObjectFromWindow(h, 0xFFFFFFF0, ref iid, out o) == 0 && o != null) res.Add(o); }
                return true;
            }, IntPtr.Zero);
        }
        return res.ToArray();
    }
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
# X/Y/W/H và kết quả theo tọa độ của tool; chụp theo pixel thật (× $script:screenScale) để đúng khi Windows Scale ≠ 100%
$script:screenScale = [Vdb]::ScreenScale()
function Ocr-Screen([int]$X, [int]$Y, [int]$W, [int]$H, [int]$Scale = 3, [string]$SaveTo = '') {
    Init-Ocr
    $s = $script:screenScale
    $bmp = New-Object Drawing.Bitmap ([Math]::Max(1, [int][Math]::Round($W * $s))), ([Math]::Max(1, [int][Math]::Round($H * $s)))
    $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen([int][Math]::Round($X * $s), [int][Math]::Round($Y * $s), 0, 0, $bmp.Size); $g.Dispose()
    $big = New-Object Drawing.Bitmap ($W * $Scale), ($H * $Scale)
    $g = [Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($bmp, 0, 0, $big.Width, $big.Height); $g.Dispose(); $bmp.Dispose()
    if ($SaveTo) { try { $big.Save($SaveTo, [Drawing.Imaging.ImageFormat]::Png) } catch { Write-Log WARN "không lưu được ảnh chẩn đoán $SaveTo`: $($_.Exception.Message)" } }
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


$ToolDir = $PSScriptRoot
$LogFile = Join-Path $ToolDir '_vietda-ck-import.log'
$LedgerFile = Join-Path $ToolDir '_vietda-ck-da-nhap.txt'
$MapFile = Join-Path $ToolDir '_vietda-map-mst.csv'
$InputDir = Join-Path $ToolDir 'Input'
$OutDir = Join-Path (Join-Path $ToolDir 'Output') (Get-Date -Format 'yyyy-MM-dd_HHmmss')
$FormTitles = @{ 'Phiếu thu tiền gửi' = 'Thu'; 'Phiếu chi tiền gửi' = 'Chi' }
$ReasonPrefix = @{ Thu = 'Thu tiền bán hàng theo HD '; Chi = 'Chuyển trả tiền hàng theo HD ' }

# Lý do = tiền tố + số HĐ + "ngày dd/mm/yyyy" (06/11/2026). $Refs = @(@{ Number; Date }) theo thứ tự HĐ; Date 'yyyy-mm-dd' (XML)
# hoặc 'dd/mm/yyyy' (Excel). Cùng 1 ngày → "HD 123, 124 ngày 01/09/2026"; khác ngày → "HD 123 ngày 01/09/2026, 124 ngày 02/09/2026".
function Format-InvoiceRef([string]$M, $Refs) {
    $vi = { param($d) $d = [string]$d; if ($d -match '^(\d{4})-(\d{2})-(\d{2})') { "$($Matches[3])/$($Matches[2])/$($Matches[1])" } elseif ($d -match '^\d{2}/\d{2}/\d{4}') { $d.Substring(0, 10) } else { '' } }
    $items = @($Refs | ForEach-Object { [pscustomobject]@{ N = [string]$_.Number; D = (& $vi $_.Date) } })
    $dates = @($items | ForEach-Object { $_.D } | Select-Object -Unique)
    $text = if ($dates.Count -eq 1 -and $dates[0]) { (($items | ForEach-Object { $_.N }) -join ', ') + " ngày $($dates[0])" }
        else { ($items | ForEach-Object { if ($_.D) { "$($_.N) ngày $($_.D)" } else { $_.N } }) -join ', ' }
    $missing = @($items | Where-Object { -not $_.D }).Count
    if ($missing) { Write-Log WARN "[$M] Lý do HD $(($items | ForEach-Object { $_.N }) -join ', '): $missing HĐ không có ngày → ghi số HĐ không kèm ngày" }
    return $ReasonPrefix[$M] + $text
}
# GD KHÔNG qua Đối soát CK / XML: nhận theo nội dung CK sao kê (bỏ dấu, hoa/thường) → lý do chuẩn + đối tượng + TK gõ vào lưới.
# Object 'RETAIL' = mã Khách lẻ (-RetailObject). Thứ tự = ưu tiên khi diễn giải khớp nhiều loại.
$OtherKinds = @(
    [pscustomobject]@{ Name = 'Nộp tiền mặt vào TK'; Mode = 'Thu'; Match = 'NOP TIEN MAT VAO TAI KHOAN CONG TY'; Reason = 'Nộp tiền mặt vào tài khoản công ty'; Object = $CompanyObject; Debit = '1121'; Credit = '1111' }
    [pscustomobject]@{ Name = 'Rút tiền gửi nhập quỹ'; Mode = 'Chi'; Match = 'RUT TIEN GUI VE NHAP QUY TIEN MAT'; Reason = 'Rút tiền gửi về nhập quỹ tiền mặt'; Object = $CompanyObject; Debit = '1111'; Credit = '1121' }
    # Chi lương: đối tượng = nhân viên NVxxx có tên trong nội dung CK / tên người nhận (đúng 1 người), không thấy → công ty
    [pscustomobject]@{ Name = 'Chi lương'; Mode = 'Chi'; Match = 'CHI LUONG THANG CHO CAN BO NHAN VIEN'; Reason = 'Chi lương tháng cho cán bộ nhân viên'; Object = $CompanyObject; Person = 'NV'; Debit = '334'; Credit = '1121' }
    [pscustomobject]@{ Name = 'Trả tiền chuyển nhầm'; Mode = 'Chi'; Match = 'CHUYEN TRA TIEN CHUYEN NHAM'; Reason = 'Chuyển trả tiền chuyển nhầm'; Object = $WalkInObject; Debit = '3388'; Credit = '1121' }
)
function Get-OtherKind([string]$M, $T) {
    $d = Normalize-Name $T.Desc
    @($OtherKinds | Where-Object { $_.Mode -eq $M -and $d.Contains($_.Match) }) | Select-Object -First 1
}

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

# File trong Input\ (bỏ file khóa ~$ của Excel); không có → mở thư mục cho kế toán copy file vào
function Get-InputFiles([string]$Ext, [string]$What) {
    if (-not (Test-Path -LiteralPath $InputDir)) { New-Item -ItemType Directory -Path $InputDir | Out-Null }
    $files = @(Get-ChildItem -LiteralPath $InputDir -File | Where-Object { $_.Extension -eq $Ext -and $_.Name -notlike '~$*' } | Sort-Object Name | ForEach-Object { $_.FullName })
    if ($files.Count -eq 0) {
        Start-Process explorer.exe $InputDir
        Fail "Chưa có $What trong $InputDir — copy file vào thư mục vừa mở rồi chạy lại."
    }
    return $files
}

# Thư mục XML cố định (06/11/2026, bỏ hộp chọn thư mục): <tool>\xml hoặc <tool>\Input\xml, trong có sold\ + purchase\
# (quét cả thư mục con nên tên con không bắt buộc). Không có → mở thư mục tool rồi dừng.
function Find-XmlFolder {
    $cands = @((Join-Path $ToolDir 'xml'), (Join-Path $InputDir 'xml'))
    # chỉ tính thư mục có file .xml (thư mục xml\ trong zip tải về chỉ có HUONG-DAN.txt)
    $found = @($cands | Where-Object { (Test-Path -LiteralPath $_ -PathType Container) -and @(Get-ChildItem -LiteralPath $_ -Filter *.xml -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).Count })
    if (-not $found.Count) {
        $open = @($cands | Where-Object { Test-Path -LiteralPath $_ -PathType Container }) + @($ToolDir)
        Start-Process explorer.exe $open[0]
        Fail "Chưa có XML hóa đơn trong $($cands -join ' / ') — bỏ XML vào xml\sold (bán ra) + xml\purchase (mua vào) cạnh tool rồi chạy lại."
    }
    if ($found.Count -gt 1) { Write-Log WARN "Cả $($found -join ' và ') đều có XML — chỉ dùng $($found[0])" }
    $dir = $found[0]
    foreach ($sub in 'sold', 'purchase') {
        if (-not (Test-Path -LiteralPath (Join-Path $dir $sub) -PathType Container)) { Write-Log WARN "Thư mục XML $dir không có thư mục con '$sub' (vẫn quét mọi XML trong đó)" }
    }
    return $dir
}

# ---------- Sao kê TPBank (.xlsx) — cùng layout utils/tpbank-statement.util.ts ----------
# A = Ngày GD (dd/mm/yyyy hh:mm:ss), C = Diễn giải, D = Ghi nợ, E = Ghi có, H = Chủ TK đối ứng, I = Mã GD
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

# File xuất "DANH MỤC ĐỐI TƯỢNG" của VietDA (vd DANH SACH.xlsx) → danh mục chính xác (mã, MST, tên), thay cho OCR list Đối tượng
function Test-ObjectList($Rows) {
    foreach ($r in @($Rows | Select-Object -First 5)) { if ((Normalize-Name ([string]$r['A'])) -eq 'DANH MUC DOI TUONG') { return $true } }
    return $false
}

function Read-ObjectList($Rows) {
    $hdr = $null
    foreach ($r in $Rows) { if ((Normalize-Name ([string]$r['B'])) -eq 'MA DOI TUONG') { $hdr = $r; break } }
    if (-not $hdr) { throw "không thấy cột 'Mã đối tượng'" }
    $col = @{}
    foreach ($k in $hdr.Keys) {
        switch (Normalize-Name ([string]$hdr[$k])) { 'MA DOI TUONG' { $col.Code = $k } 'TEN DOI TUONG' { $col.Name = $k } 'MA SO THUE' { $col.Mst = $k } }
    }
    if (-not $col.Name -or -not $col.Mst) { throw "thiếu cột 'Tên đối tượng' / 'Mã số thuế'" }
    $list = New-Object System.Collections.Generic.List[object]
    foreach ($r in $Rows) {
        $code = ([string]$r[$col.Code]).Trim()
        if (-not $code -or ([string]$r['A']).Trim() -notmatch '^\d+$') { continue }
        $name = ([string]$r[$col.Name]).Trim()
        $list.Add([pscustomobject]@{ Code = $code; Name = $name; Norm = (Normalize-Name $name); Mst = ([string]$r[$col.Mst]).Trim() })
    }
    return $list
}

function Read-Statement($Rows) {
    $txns = New-Object System.Collections.Generic.List[object]
    foreach ($cells in $Rows) {
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

# ---------- Excel Đối soát CK (KeToan, từ 06/11/2026: bank-recon-export.util.ts) → Mã GD → dòng sheet Nhap-VietDA ----------
# Bán ra + mua vào chung 1 file doi-soat-ck_<từ>_<đến>.xlsx. Sheet Thong-tin "Định dạng" phải = $ReconSchema (đổi/bỏ cột = tăng số).
# Sheet Nhap-VietDA: dòng 1 = tiêu đề, đọc theo TÊN cột; mỗi GD sao kê đúng 1 dòng.
$ReconSchema = 'taphoa39-doi-soat-ck/1'
$ReconSheet = 'Nhap-VietDA'
$ReconCols = @('Loại', 'Mã GD', 'Số tiền', 'Kết quả khớp', 'Lập phiếu theo HĐ', 'Lý do không lập', 'Độ tin cậy', 'Số HĐ', 'Ký hiệu HĐ', 'Ngày HĐ', 'Tổng HĐ', 'MST đối tác', 'Tên đối tác')

function Test-ReconXlsx([string]$Path) { (@(Get-XlsxSheetNames $Path) -contains $ReconSheet) }

# "123, 124" → @('123','124')
function Split-List([string]$s) { @(([string]$s -split '\s*[,;]\s*') | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }

function Read-ReconXlsx([string]$Path) {
    $info = Read-XlsxRows $Path 'Thong-tin'
    $schema = ''
    foreach ($r in $info) { if (([string]$r['A']).Trim() -eq 'Định dạng') { $schema = ([string]$r['B']).Trim(); break } }
    if ($schema -ne $ReconSchema) { throw "định dạng '$(if ($schema) { $schema } else { 'không ghi' })' — tool này đọc '$ReconSchema'. Tải lại tool mới ở trang Tải công cụ hoặc xuất lại Excel từ trang Đối soát CK." }

    $rows = Read-XlsxRows $Path $ReconSheet
    if ($rows.Count -lt 1) { throw "sheet $ReconSheet trống" }
    $col = @{}
    foreach ($k in $rows[0].Keys) { $col[([string]$rows[0][$k]).Trim()] = $k }
    $missing = @($ReconCols | Where-Object { -not $col.ContainsKey($_) })
    if ($missing.Count) { throw "sheet $ReconSheet thiếu cột: $($missing -join ', ')" }
    $get = { param($r, $name) ([string]$r[$col[$name]]).Trim() }
    $num = { param($x) $d = 0.0; if ($x -and [double]::TryParse($x, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { [long][Math]::Round($d) } else { 0L } }

    $map = @{}
    $odd = 0
    $dup = 0
    for ($i = 1; $i -lt $rows.Count; $i++) {
        $r = $rows[$i]
        $code = & $get $r 'Mã GD'
        if (-not $code) { continue }
        if ($map.ContainsKey($code)) { $dup++; continue }
        $mode = & $get $r 'Loại'
        $make = & $get $r 'Lập phiếu theo HĐ'
        $noWhy = & $get $r 'Lý do không lập'
        if ($mode -notin @('Thu', 'Chi') -or $make -notin @('Có', 'Không')) {
            $odd++
            $noWhy = "dòng $($i + 1) Excel lạ: Loại='$mode', Lập phiếu theo HĐ='$make'"
            $make = 'Không'
        }
        $map[$code] = [pscustomobject]@{
            Mode = $mode; Code = $code; Amount = (& $num (& $get $r 'Số tiền'))
            Match = & $get $r 'Kết quả khớp'; Make = ($make -eq 'Có'); NoWhy = $noWhy; Confidence = & $get $r 'Độ tin cậy'
            Numbers = @(Split-List (& $get $r 'Số HĐ')); Serials = @(Split-List (& $get $r 'Ký hiệu HĐ')); Dates = @(Split-List (& $get $r 'Ngày HĐ'))
            Total = (& $num (& $get $r 'Tổng HĐ')); Msts = @(Split-List (& $get $r 'MST đối tác')); Name = & $get $r 'Tên đối tác'
        }
    }
    if ($odd) { Write-Log WARN "$(Split-Path $Path -Leaf): $odd dòng Loại / Lập phiếu theo HĐ không hợp lệ → coi như không lập theo HĐ" }
    if ($dup) { Write-Log WARN "$(Split-Path $Path -Leaf): $dup dòng trùng Mã GD trong file (lấy dòng đầu)" }
    return $map
}

# ---------- XML hóa đơn mua vào + bán ra (quét cả thư mục con) ----------
function Read-InvoiceXml([string]$Folder) {
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
                Serial = & $pick "//*[local-name()='TTChung']/*[local-name()='KHHDon']"
                Date = & $pick "//*[local-name()='TTChung']/*[local-name()='NLap']"
                SellerMst = & $pick "//*[local-name()='NBan']/*[local-name()='MST']"
                SellerName = & $pick "//*[local-name()='NBan']/*[local-name()='Ten']"
                BuyerMst = & $pick "//*[local-name()='NMua']/*[local-name()='MST']"
                BuyerName = & $pick "//*[local-name()='NMua']/*[local-name()='Ten']"
                BuyerPerson = & $pick "//*[local-name()='NMua']/*[local-name()='HVTNMHang']"
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
    if ($v -and $v.Form -ne [IntPtr]::Zero -and -not (Close-VoucherForm)) { throw "phiếu $($v.Kind.ToLower()) tiền gửi đang mở còn dữ liệu — Lưu hoặc Thoát không lưu rồi chạy lại" }
    $want = if ($Kind -eq 'Thu') { '(?i)^Phi\S*\s+thu\s+.*\(b' } else { '(?i)^Phi\S*\s+chi\s+.*\(b' }
    Click-ThuChiItem $want "Phiếu $($Kind.ToLower()) tiền gửi"
    $wait = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $wait) {
        Start-Sleep -Milliseconds 300
        $v = Find-Vietda
        if ($v -and $v.Kind -eq $Kind) { Start-Sleep -Milliseconds 500; return $v }
    }
    throw "đã bấm menu nhưng không thấy phiếu $Kind mở ra"
}

# Bấm menu Thu chi rồi bấm mục có chữ khớp $Want (OCR menu xổ)
function Click-ThuChiItem([string]$Want, [string]$What) {
    if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
    $kids = @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::GetParent($_) -eq $script:vda.Main -and [Vdb]::IsWindowVisible($_) } |
        ForEach-Object { $r = [Vdb]::Rect($_); [pscustomobject]@{ H = $_; L = $r.L; T = $r.T; W = $r.R - $r.L; Ht = $r.B - $r.T; Name = [Vdb]::TextOf($_) } })
    # control thanh menu VietDA tên 'mainMenu'; không có thì lấy dải con cao 15–40 px trên cùng
    $bar = @($kids | Where-Object { $_.Name -eq 'mainMenu' -and $_.Ht -gt 0 }) | Select-Object -First 1
    if (-not $bar) { $bar = @($kids | Where-Object { $_.Ht -ge 15 -and $_.Ht -le 40 } | Sort-Object T) | Select-Object -First 1 }
    if (-not $bar) { throw 'không thấy thanh menu VietDA' }
    $diag = Join-Path $PSScriptRoot '_vietda-menu.png'
    $line = @(Ocr-Screen $bar.L $bar.T ([Math]::Min($bar.W, 900)) $bar.Ht 3 $diag)
    $words = @($line | ForEach-Object { $_.Words })
    $hit = $null
    for ($i = 0; $i -lt $words.Count -and -not $hit; $i++) {
        if ($words[$i].Text -match '(?i)^Th[uưúùủũụ]-?ch[iíìỉĩị]') { $hit = $words[$i]; $hit.X -= 10 }
        elseif ($i -lt $words.Count - 1 -and $words[$i].Text -match '(?i)^Th[uưúùủũụ]$' -and $words[$i + 1].Text -match '(?i)^ch[iíìỉĩị]') { $hit = $words[$i] }
    }
    if (-not $hit) { throw "OCR không thấy menu 'Thu chi' (đọc được: '$(($line | ForEach-Object { $_.Text }) -join ' / ')'; thanh menu $($bar.L),$($bar.T) $($bar.W)x$($bar.Ht), Scale màn hình $([Math]::Round($script:screenScale * 100))%) — ảnh vùng đã đọc: $diag" }
    Remove-Item -LiteralPath $diag -ErrorAction SilentlyContinue
    Write-Log INFO "Menu 'Thu chi' ở $($hit.X),$($hit.Y) (Scale màn hình $([Math]::Round($script:screenScale * 100))%)"

    $drop = $null
    # VietDA vừa đóng phiếu / hộp thoại có thể nuốt cú click đầu → thử lại 1 lần
    for ($attempt = 1; $attempt -le 2 -and -not $drop; $attempt++) {
        if ($attempt -gt 1) {
            Write-Log WARN "menu 'Thu chi' không xổ xuống — thử lại"
            [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
            Start-Sleep -Milliseconds 700
            if (-not [Vdb]::Activate($script:vda.Main)) { throw 'không đưa được VietDA lên trước (foreground)' }
        }
        $before = @{}
        foreach ($t in [Vdb]::Tops($script:vda.Pid)) { $before[$t.ToInt64()] = $true }
        Assert-Foreground
        [Vdb]::Click($hit.X + 10, $hit.Y)
        $wait = (Get-Date).AddSeconds(3)
        while (-not $drop -and (Get-Date) -lt $wait) {
            Start-Sleep -Milliseconds 200
            # menu xổ = cửa sổ mới có kích thước thật (bỏ bóng đổ / cửa sổ tạm 0x0, vd hộp thoại vừa đóng)
            $drop = @([Vdb]::Tops($script:vda.Pid) | Where-Object { -not $before.ContainsKey($_.ToInt64()) -and [Vdb]::ClassOf($_) -notlike '*Shadow*' -and [Vdb]::ClassOf($_) -ne '#32770' } |
                Where-Object { $rc = [Vdb]::Rect($_); ($rc.R - $rc.L) -gt 40 -and ($rc.B - $rc.T) -gt 40 }) | Select-Object -First 1
        }
    }
    if (-not $drop) { throw "bấm 'Thu chi' nhưng menu không xổ xuống" }
    Start-Sleep -Milliseconds 300
    $r = [Vdb]::Rect($drop)
    $items = @(Ocr-Screen $r.L $r.T ($r.R - $r.L) ($r.B - $r.T) 3)
    $item = @($items | Where-Object { $_.Text -match $Want }) | Select-Object -First 1
    if (-not $item) {
        [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        throw "OCR không thấy mục $What trong menu (đọc được: $(($items | ForEach-Object { $_.Text }) -join ' / '))"
    }
    Assert-Foreground
    [Vdb]::Click($item.X, $item.Y)
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


# $Mode Thu/Chi: 1 công ty có thể vừa là khách (KH…) vừa là NCC (NCC…) → trùng MST thì ưu tiên mã theo tiền tố của loại phiếu
$CodePrefer = @{ Thu = 'KH'; Chi = 'NCC' }
function Resolve-Object($Mst, $Name, $Objects, $ManualMap, [string]$Mode) {
    foreach ($k in @("$Mode|$Mst", $Mst)) { if ($ManualMap.ContainsKey($k)) { return @{ Code = $ManualMap[$k]; By = '_vietda-map-mst.csv' } } }
    $n = Normalize-Name $Name
    $pref = $CodePrefer[$Mode]
    $byMst = @($Objects | Where-Object { $_.Mst -eq $Mst -or $_.Code -eq $Mst })
    if ($byMst.Count -eq 1) { return @{ Code = $byMst[0].Code; By = 'MST' } }
    if ($byMst.Count -gt 1) {
        $named = @($byMst | Where-Object { $_.Norm -eq $n })
        if ($named.Count -eq 1) { return @{ Code = $named[0].Code; By = 'MST + tên' } }
        $pre = @($byMst | Where-Object { $pref -and $_.Code -like "$pref*" })
        if ($pre.Count -eq 1) { return @{ Code = $pre[0].Code; By = "MST + mã $pref…" } }
        return @{ Error = "$($byMst.Count) mã cùng MST $Mst ($(($byMst | ForEach-Object { $_.Code }) -join ', ')) — ghi MST;Mã;$Mode vào _vietda-map-mst.csv" }
    }
    $byName = @($Objects | Where-Object { $_.Norm -and $_.Norm -eq $n })
    if ($byName.Count -eq 1) { return @{ Code = $byName[0].Code; By = 'tên' } }
    if ($byName.Count -gt 1) {
        $pre = @($byName | Where-Object { $pref -and $_.Code -like "$pref*" })
        if ($pre.Count -eq 1) { return @{ Code = $pre[0].Code; By = "tên + mã $pref…" } }
        return @{ Error = "$($byName.Count) mã cùng tên '$Name' ($(($byName | ForEach-Object { $_.Code }) -join ', ')) — ghi MST;Mã;$Mode vào _vietda-map-mst.csv" }
    }
    return @{ Error = "chưa có đối tượng MST $Mst '$Name' trong danh mục VietDA — thêm đối tượng hoặc ghi MST;Mã vào _vietda-map-mst.csv" }
}

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

# Sau khi đổi Ngày: chờ hộp hỏi đánh lại Số CT (Yes); hộp khác → FATAL. Trả $null nếu ổn.
# $TimeoutMs: khác tháng Số CT → 1500 (hộp CHẮC hiện, thoát ngay khi thấy); cùng tháng → ngắn (chỉ bắt hộp lạ), không chờ phí 1,5 giây/phiếu
function Wait-DateDialog([int]$TimeoutMs = 1500) {
    $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 150
        $dlgs = @([Vdb]::Dialogs($script:vda.Pid))
        if (-not $dlgs.Count) { continue }
        foreach ($d in $dlgs) {
            $text = [Vdb]::MessageText($d)
            if ($text -match '(?i)Số chứng từ tự động' -and [Vdb]::ButtonCount($d) -gt 1) {
                Write-Log INFO "VietDA hỏi '$($text -replace '\s+', ' ')' → Yes"
                [Vdb]::Press($d, 6)
            } else { return New-Result FATAL "VietDA báo sau khi nhập Ngày — $text (để nguyên cho người dùng xử lý)" }
        }
        $idle = (Get-Date).AddSeconds(5)
        while (([Vdb]::Dialogs($script:vda.Pid).Count -or -not [Vdb]::IsIdle($script:vda.Main)) -and (Get-Date) -lt $idle) { Start-Sleep -Milliseconds 150 }
        if (-not [Vdb]::Activate($script:vda.Main)) { return New-Result FATAL 'không đưa được VietDA lên trước sau hộp hỏi Số CT' }
        return $null
    }
    return $null
}

function Invoke-Voucher($Item) {
    $c = $script:ctl
    if (-not [Vdb]::Activate($script:vda.Main)) { return New-Result FATAL 'không đưa được VietDA lên trước (foreground)' }
    # phiếu trước đã Lưu + Thêm → phiếu đang mở phải trống
    if ((Digits ([Vdb]::TextOf($c.Total.H))) -ne 0) { return New-Result FATAL "phiếu đang mở đã có dữ liệu (Tổng thanh toán $([Vdb]::TextOf($c.Total.H))) — bấm Thêm/mở phiếu mới rồi chạy lại" }

    # tháng của Số CT trước khi đổi Ngày (TG006/08 → 08); không đọc được → coi như khác tháng (chờ đủ)
    $soCtBefore = [Vdb]::TextOf($c.SoCt.H)
    $sameMonth = $soCtBefore -match '/(\d{2})\s*$' -and $Matches[1] -eq $Item.Date.Substring(3, 2)
    Click-Control $c.Date 10
    Send-Keys $Item.Date
    if ([Vdb]::TextOf($c.Date.H) -ne $Item.Date) { return New-Result FATAL "không đặt được Ngày (đọc lại: '$([Vdb]::TextOf($c.Date.H))')" }
    # Rời ô Ngày khi tháng khác tháng của Số CT (vd TG006/08, ngày 30/10) → VietDA hỏi "điền lại Số chứng từ tự động?" → Yes (số theo tháng mới)
    Send-Keys '{TAB}'
    if (-not $sameMonth) { Write-Log INFO "Số CT '$soCtBefore' khác tháng ngày $($Item.Date) → chờ VietDA hỏi điền lại Số CT" }
    $r = Wait-DateDialog $(if ($sameMonth) { 300 } else { 1500 })
    if ($r) { return $r }

    $ok = Set-Field $c.ObjectEdit $Item.Object { ([Vdb]::TextOf($c.ObjectEdit.H) -eq $Item.Object) -and [Vdb]::TextOf($c.ObjectName.H) }
    if (-not $ok) { return New-Result FATAL "không chọn được Đối tượng $($Item.Object) (đọc lại: '$([Vdb]::TextOf($c.ObjectEdit.H))' / '$([Vdb]::TextOf($c.ObjectName.H))')" }

    $ok = Set-Field $c.ReasonEdit $Item.Reason { [Vdb]::TextOf($c.ReasonEdit.H) -eq $Item.Reason }
    if (-not $ok) { return New-Result FATAL "không nhập được Lý do (đọc lại: '$([Vdb]::TextOf($c.ReasonEdit.H))')" }

    Click-Control $c.Grid $AmountCell[0] $AmountCell[1]
    Send-Keys "$($Item.Amount){TAB}"
    # GD không theo HĐ (nộp/rút tiền mặt, lương, trả chuyển nhầm): sau Số tiền là ô TK Nợ, TK Có (VietDA mặc định sai TK cho các loại này)
    if ($Item.Debit) { Send-Keys "$($Item.Debit){TAB}"; Send-Keys "$($Item.Credit){TAB}" }
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

# ---------- Kết quả chạy + Bảng kê VietDA → Output\<ngày-giờ>\ ----------
$script:rows = New-Object System.Collections.Generic.List[object]
$script:objByCode = @{}
$script:prefix = @{}
# Nguồn + "Lý do không lập" (Excel đối soát) của GD đang xét — Build-Queue đặt trước khi gọi Add-Row
$script:rowSource = ''
$script:rowNoWhy = ''

# 1 dòng kết quả cho 1 GD sao kê (Kết quả / Số CT cập nhật dần khi chạy)
function Add-Row([string]$M, $T, [string]$Result, [string]$SoCt = '', [string]$Object = '', [string]$Reason = '', [string]$Note = '') {
    $row = [pscustomobject]@{
        Mode = $M; Code = $T.Code; DateTime = $T.DateTime; Date = $T.Date; Amount = $T.Debit + $T.Credit; Desc = $T.Desc
        Object = $Object; ObjectName = $(if ($Object -and $script:objByCode.ContainsKey($Object)) { $script:objByCode[$Object] } else { '' })
        Reason = $Reason; Result = $Result; SoCt = $SoCt; Note = $Note; Source = $script:rowSource; NoWhy = $script:rowNoWhy
        Check = ''; VdDate = ''; VdName = ''; VdReason = ''; VdAmount = ''
    }
    $script:rows.Add($row)
    return $row
}

function Squash([string]$s) { (($s -replace '\s+', ' ').Trim()).ToUpperInvariant() }

# Tiền tố Số CT của loại phiếu (TG006/10 → TG) = giá trị ô "Loại chứng từ" khi tìm kiếm
# Nhớ qua các lần chạy ở _vietda-loai-ct.txt (Thu=TG …) — KHÔNG mở phiếu chỉ để đọc (mở phiếu bằng menu có thể để lại phiếu trống)
$PrefixFile = Join-Path $ToolDir '_vietda-loai-ct.txt'
if (Test-Path -LiteralPath $PrefixFile) {
    foreach ($line in Get-Content -LiteralPath $PrefixFile -Encoding UTF8) { if ($line -match '^(Thu|Chi)=([A-Za-z]+)$') { $script:prefix[$Matches[1]] = $Matches[2] } }
}
function Save-Prefix([string]$M) {
    if ([Vdb]::TextOf($script:ctl.SoCt.H) -notmatch '^([A-Za-z]+)') { return }
    if ($script:prefix[$M] -eq $Matches[1]) { return }
    $script:prefix[$M] = $Matches[1]
    @($script:prefix.Keys | Sort-Object | ForEach-Object { "$_=$($script:prefix[$_])" }) | Set-Content -LiteralPath $PrefixFile -Encoding UTF8
    Write-Log INFO "[$M] Loại chứng từ (tiền tố Số CT) = $($Matches[1])"
}

function Get-ModePrefix([string]$M) {
    if ($script:prefix[$M]) { return $script:prefix[$M] }
    $s = @($script:rows | Where-Object { $_.Mode -eq $M -and $_.SoCt -match '^[A-Za-z]+' }) | Select-Object -First 1
    if ($s -and $s.SoCt -match '^([A-Za-z]+)') { return $Matches[1] }
    return ''
}

function Get-VisibleKids($Root) {
    foreach ($h in [Vdb]::Descendants($Root)) {
        if (-not [Vdb]::IsWindowVisible($h)) { continue }
        $r = [Vdb]::Rect($h)
        [pscustomobject]@{ H = $h; Cls = [Vdb]::ClassOf($h); Text = (([Vdb]::TextOf($h) -replace '&(?=\S)', '').Trim()); L = $r.L; T = $r.T; R = $r.R; B = $r.B; CY = ($r.T + $r.B) / 2 }
    }
}

function Find-Listings { @([Vdb]::Descendants($script:vda.Main) | Where-Object { [Vdb]::IsWindowVisible($_) -and [Vdb]::TextOf($_) -eq 'Bảng kê chứng từ thu chi' }) }

function Find-SearchDialog {
    $cands = @([Vdb]::Tops($script:vda.Pid)) + @([Vdb]::Descendants($script:vda.Main))
    @($cands | Where-Object { [Vdb]::IsWindowVisible($_) -and [Vdb]::TextOf($_) -like 'Tìm kiếm chứng từ thu chi*' }) | Select-Object -First 1
}

# VietDA GHI NGAY 1 bản ghi trống (0 đ) khi mở phiếu (menu / nút Thêm), mỗi phiếu 1 tab; Thoát + "No" thì xóa bản ghi đó
# (thử 05/11/2026: tab TG024…TG028 đang mở đều hiện trên bảng kê; Thoát + No → TG022 biến mất).
# → Thoát phiếu trống đang hiện. Phiếu còn dữ liệu (tool dừng giữa phiếu) / không đọc được → KHÔNG đóng, trả $false.
function Close-VoucherForm {
    $v = Find-Vietda
    if (-not $v -or $v.Form -eq [IntPtr]::Zero) { return $true }
    try { $amt = Digits ([Vdb]::TextOf((Get-Controls $v.Form).Total.H)) } catch { Write-Log WARN "không đọc được phiếu đang mở: $($_.Exception.Message)"; return $false }
    if ($amt -ne 0) { Write-Log WARN "phiếu $($v.Kind) đang mở còn dữ liệu (Tổng thanh toán $amt) — không đóng"; return $false }
    $quit = @(Get-VisibleKids $v.Form | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Thoát*' }) | Select-Object -First 1
    if (-not $quit) { Write-Log WARN "phiếu $($v.Kind) đang mở không có nút Thoát"; return $false }
    [Vdb]::ClickButton($quit.H)
    $wait = (Get-Date).AddSeconds(5)
    while ((Get-Date) -lt $wait) {
        Start-Sleep -Milliseconds 250
        foreach ($d in [Vdb]::Dialogs($script:vda.Pid)) {
            $text = [Vdb]::MessageText($d)
            if ($text -match '(?i)lưu' -and [Vdb]::ButtonCount($d) -gt 1) { Write-Log INFO "Thoát phiếu trống, VietDA hỏi '$text' → chọn No"; [Vdb]::Press($d, 7) }
            elseif ($text -match '(?i)Chưa có Số' -and [Vdb]::ButtonCount($d) -eq 1) { Write-Log INFO 'Thoát phiếu trống, VietDA báo "Chưa có Số cho chứng từ này" → OK'; [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 })) }
            else { Write-Log WARN "Thoát phiếu trống, VietDA báo '$text' — để nguyên"; return $false }
        }
        $now = Find-Vietda
        if (-not $now -or $now.Form -ne $v.Form) {
            $idle = (Get-Date).AddSeconds(5)
            while (-not [Vdb]::IsIdle($script:vda.Main) -and (Get-Date) -lt $idle) { Start-Sleep -Milliseconds 200 }
            Start-Sleep -Milliseconds 500
            Write-Log INFO "Đã Thoát phiếu $($v.Kind.ToLower()) trống."
            return $true
        }
    }
    Write-Log WARN "bấm Thoát nhưng phiếu $($v.Kind) vẫn mở"
    return $false
}

# Dọn tab: Thoát mọi phiếu trống (xóa bản ghi 0 đ) + đóng bảng kê, lần lượt tab đang hiện; gặp phiếu có dữ liệu → dừng ($false)
function Close-ToolTabs {
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Milliseconds 400
        $dlgs = @([Vdb]::Dialogs($script:vda.Pid))
        if ($dlgs.Count) {
            # chuyển sang tab phiếu kế tiếp, VietDA hay báo "Chưa có Số cho chứng từ này !?" (1 nút OK) → OK rồi dọn tiếp
            foreach ($d in $dlgs) {
                $text = [Vdb]::MessageText($d)
                if ($text -notmatch '(?i)Chưa có Số' -or [Vdb]::ButtonCount($d) -ne 1) { Write-Log WARN "VietDA đang mở hộp thoại '$text' — dừng dọn tab"; return $false }
                Write-Log INFO 'VietDA báo "Chưa có Số cho chứng từ này" → OK'
                [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 }))
            }
            continue
        }
        $v = Find-Vietda
        if ($v -and $v.Form -ne [IntPtr]::Zero) { if (-not (Close-VoucherForm)) { return $false }; continue }
        $l = @(Find-Listings) | Select-Object -First 1
        if (-not $l) { return $true }
        $quit = @(Get-VisibleKids $l | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Thoát' }) | Select-Object -First 1
        if (-not $quit) { Write-Log WARN 'bảng kê không có nút Thoát — dừng dọn tab'; return $true }
        [Vdb]::ClickButton($quit.H)
        $wait = (Get-Date).AddSeconds(3)
        while ([Vdb]::IsWindowVisible($l) -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
        Write-Log INFO 'Đã đóng tab bảng kê.'
    }
    return $true
}

# Hộp Tìm kiếm là modal: để mở thì VietDA không bấm menu / list được nữa → luôn đóng (nút Thoát (ESC)) khi lỗi
function Close-SearchDialog {
    $dlg = Find-SearchDialog
    if (-not $dlg) { return }
    $quit = @(Get-VisibleKids $dlg | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -like 'Thoát*' }) | Select-Object -First 1
    if ($quit) { [Vdb]::ClickButton($quit.H) } else { [Vdb]::Press($dlg, 2) }
    $wait = (Get-Date).AddSeconds(3)
    while ((Find-SearchDialog) -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    if (Find-SearchDialog) { Write-Log WARN 'không đóng được hộp Tìm kiếm chứng từ — bấm Thoát (ESC) trên VietDA' } else { Write-Log INFO 'Đã đóng hộp Tìm kiếm chứng từ.' }
}

function Get-XlBooks {
    $books = @{}
    foreach ($w in [VdXl]::Windows()) {
        try { $wb = $w.Parent; $key = "$($wb.Application.Hwnd)|$($wb.Name)"; if (-not $books.ContainsKey($key)) { $books[$key] = $wb } } catch { }
    }
    return $books
}

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

# Bảng kê VietDA (Value2 của sheet) → các phiếu { SoCt, Date, Name, Reason, Amount } + dòng "Từ ngày … / Loại phiếu …"
function Read-ListingRows($Ws) {
    $ur = $Ws.UsedRange
    $v = $ur.Value2
    $nr = $ur.Rows.Count; $nc = $ur.Columns.Count
    $cell = { param($r, $c) $x = $v[$r, $c]; if ($null -eq $x) { '' } else { ([string]$x).Trim() } }
    $info = @(for ($r = 1; $r -le [Math]::Min($nr, 12); $r++) { $t = & $cell $r 1; if ($t -match '(?i)^(Từ ngày|Loại phiếu)') { $t -replace '\s+', ' ' } })
    $hdr = 0
    for ($r = 1; $r -le $nr -and -not $hdr; $r++) { if ((& $cell $r 1) -eq 'STT') { $hdr = $r } }
    if (-not $hdr) { throw "bảng kê VietDA không có dòng tiêu đề 'STT' (đổi mẫu?)" }
    $col = @{}
    for ($c = 1; $c -le $nc; $c++) {
        switch (Normalize-Name (& $cell $hdr $c)) {
            'CHUNG TU' { $col.So = $c; $col.Date = $c + 1 }
            'HO VA TEN' { $col.Name = $c }
            'LY DO' { $col.Reason = $c }
            'SO TIEN' { $col.Amount = $c }
        }
    }
    $miss = @('So', 'Name', 'Reason', 'Amount' | Where-Object { -not $col[$_] })
    if ($miss.Count) { throw "bảng kê VietDA thiếu cột: $($miss -join ', ') (đổi mẫu?)" }
    $list = New-Object System.Collections.Generic.List[object]
    for ($r = $hdr + 1; $r -le $nr; $r++) {
        if (@(for ($c = 1; $c -le $nc; $c++) { if ((Normalize-Name (& $cell $r $c)) -eq 'TONG CONG') { 1 } }).Count) { break }
        $so = & $cell $r $col.So
        if ($so -notmatch '\d' -or $so -notmatch '[^\d]') { continue }
        $d = $v[$r, $col.Date]
        $a = $v[$r, $col.Amount]
        $list.Add([pscustomobject]@{
            SoCt = $so
            Date = $(if ($d -is [double]) { [DateTime]::FromOADate($d).ToString('dd/MM/yyyy') } else { [string]$d })
            Name = & $cell $r $col.Name
            Reason = & $cell $r $col.Reason
            Amount = $(if ($a -is [double]) { [long][Math]::Round($a) } else { Digits ([string]$a) })
        })
    }
    return @{ Rows = $list; Info = ($info -join ' · ') }
}

# Thu chi > Tìm kiếm chứng từ: Ngày từ/đến + Loại chứng từ (xóa các lọc khác VietDA còn nhớ) > Hiển thị > Excel → đọc dòng rồi đóng (không lưu)
function Export-Listing([string]$Prefix, [string]$From, [string]$To) {
    Close-SearchDialog
    foreach ($old in Find-Listings) {
        $quit = @(Get-VisibleKids $old | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Thoát' }) | Select-Object -First 1
        if ($quit) { [Vdb]::ClickButton($quit.H) }
    }
    $wait = (Get-Date).AddSeconds(5)
    while ((Find-Listings).Count -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 200 }
    if ((Find-Listings).Count) { throw 'không đóng được bảng kê cũ đang mở (bấm Thoát trên bảng kê rồi chạy lại)' }

    # OCR hay mất dấu/chữ: "Tm kiém chüng tir"
    Click-ThuChiItem '(?i)^T\S{0,3}\s+ki\S{0,3}\s+ch' 'Tìm kiếm chứng từ'
    $dlg = $null
    $wait = (Get-Date).AddSeconds(10)
    while (-not $dlg -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 300; $dlg = Find-SearchDialog }
    if (-not $dlg) { throw "bấm 'Tìm kiếm chứng từ' nhưng không thấy hộp 'Tìm kiếm chứng từ thu chi'" }
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

        $cleared = New-Object System.Collections.Generic.List[string]
        foreach ($k in $kids) {
            if ($k.H -eq $c.Type.H -or [Vdb]::GetParent($k.H) -eq $c.Type.H) { continue }
            $now = [Vdb]::TextOf($k.H)
            if (-not $now) { continue }
            if ($k.Cls -like '*COMBOBOX*') { [Vdb]::SelectCombo($k.H, -1); $cleared.Add($now) }
            elseif ($k.Cls -like '*EDIT*') { [void][Vdb]::SetText($k.H, ''); $cleared.Add($now) }
        }
        if ($cleared.Count) { Write-Log INFO "Xóa lọc VietDA còn nhớ: $(($cleared | Select-Object -Unique) -join ', ')" }

        Set-DateBox $c.From $From 'Ngày chứng từ từ'
        Set-DateBox $c.To $To 'Đến ngày'

        $items = @([Vdb]::ComboItems($c.Type.H))
        $esc = [regex]::Escape($Prefix)
        $idx = -1
        for ($i = 0; $i -lt $items.Count -and $idx -lt 0; $i++) { if ($items[$i] -match "^$esc\b") { $idx = $i } }
        if ($idx -ge 0) { [Vdb]::SelectCombo($c.Type.H, $idx) }
        else {
            $e = @([Vdb]::Descendants($c.Type.H) | Where-Object { [Vdb]::ClassOf($_) -eq 'Edit' }) | Select-Object -First 1
            if (-not $e) { throw "ô Loại chứng từ không có '$Prefix' (có: $($items -join ', '))" }
            [void](Set-Field ([pscustomobject]@{ H = $e }) $Prefix { [Vdb]::TextOf($e) -eq $Prefix })
        }
        if ([Vdb]::TextOf($c.Type.H) -notmatch "^$esc") { throw "không chọn được Loại chứng từ $Prefix (đọc lại '$([Vdb]::TextOf($c.Type.H))')" }

        $r = Invoke-Button $c.Show 'Hiển thị'
        if ($r.Status -ne 'OK') { throw $r.Message }
    } catch { Close-SearchDialog; throw } finally { $script:extraFg = [IntPtr]::Zero }

    $listing = $null
    $wait = (Get-Date).AddSeconds(60)
    while (-not $listing -and (Get-Date) -lt $wait) { Start-Sleep -Milliseconds 300; $listing = @(Find-Listings) | Select-Object -First 1 }
    Close-SearchDialog
    if (-not $listing) { return @{ Rows = @(); Info = "VietDA không ra bảng kê$(if ($r.Message) { " — $($r.Message)" })" } }

    $excel = @(Get-VisibleKids $listing | Where-Object { $_.Cls -like '*BUTTON*' -and $_.Text -eq 'Excel' }) | Select-Object -First 1
    if (-not $excel) { throw "bảng kê không có nút Excel" }
    $known = Get-XlBooks
    $winBefore = @{}
    foreach ($pr in Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero }) { $winBefore["$($pr.Id)|$($pr.MainWindowHandle)"] = $true }
    [Vdb]::ClickButton($excel.H)
    $wb = $null
    $deadline = (Get-Date).AddSeconds(120)
    while (-not $wb -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 700
        # bảng kê trống / lỗi → VietDA báo 1 nút (vd không có dữ liệu): ghi lại, OK, coi như 0 phiếu
        foreach ($d in [Vdb]::Dialogs($script:vda.Pid)) {
            $text = [Vdb]::MessageText($d)
            if ([Vdb]::ButtonCount($d) -le 1) {
                [Vdb]::Press($d, $(if ([Vdb]::GetDlgItem($d, 1) -ne [IntPtr]::Zero) { 1 } else { 2 }))
                Close-ToolTabs | Out-Null
                return @{ Rows = @(); Info = "bấm Excel, VietDA báo: $text" }
            }
            throw "bấm Excel, VietDA hỏi: $text (để nguyên cho người dùng xử lý)"
        }
        foreach ($e in (Get-XlBooks).GetEnumerator()) {
            if ($known.ContainsKey($e.Key)) { continue }
            try { if ([string]$e.Value.Worksheets.Item(1).Range('A4').Text -match 'BẢNG KÊ') { $wb = $e.Value; break } } catch { }
        }
    }
    if (-not $wb) {
        # chẩn đoán: cửa sổ mới mở ra sau khi bấm Excel (Excel bản khác / WPS / hộp thoại Excel)
        $new = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and -not $winBefore.ContainsKey("$($_.Id)|$($_.MainWindowHandle)") } | ForEach-Object { "$($_.ProcessName) '$($_.MainWindowTitle)' [$([Vdb]::ClassOf($_.MainWindowHandle))]" })
        $procs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match '(?i)^(excel|et|wps|ksolaunch|scalc|soffice)' } | ForEach-Object { "$($_.ProcessName)#$($_.Id) '$($_.MainWindowTitle)'" })
        throw "bấm Excel trên bảng kê nhưng không thấy Excel mở bảng kê (120 giây) — cửa sổ mới: $(if ($new.Count) { $new -join '; ' } else { 'không có' }); tiến trình bảng tính: $(if ($procs.Count) { $procs -join '; ' } else { 'không có' })"
    }
    # VietDA ghi từng ô qua COM (chặn UI) → xong khi VietDA rảnh + số dòng đứng yên
    $stable = 0; $last = -1
    while ($stable -lt 3 -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 700
        try { $nr = $wb.Worksheets.Item(1).UsedRange.Rows.Count } catch { $stable = 0; continue }
        if ($nr -eq $last -and [Vdb]::IsIdle($script:vda.Main)) { $stable++ } else { $stable = 0; $last = $nr }
    }
    $parsed = $null
    for ($try = 1; $try -le 5 -and -not $parsed; $try++) {
        try { $parsed = Read-ListingRows $wb.Worksheets.Item(1) }
        catch { if ($try -eq 5 -or $_.Exception.Message -match 'bảng kê VietDA') { throw }; Start-Sleep -Milliseconds 700 }
    }
    # 06/11/2026: chỉ đọc để kiểm Đúng/Sai, KHÔNG lưu VietDA-bang-ke-*.xlsx vào Output (user: không cần)
    $app = $wb.Application
    $wb.Close($false)
    try { if ($app.Workbooks.Count -eq 0) { $app.Quit() } } catch { }
    Close-ToolTabs | Out-Null
    return @{ Rows = $parsed.Rows; Info = $parsed.Info }
}

# Xuất bảng kê VietDA cho từng loại phiếu (khoảng ngày = ngày GD sao kê) rồi so từng Số CT tool đã tạo
function Invoke-Verify {
    $notes = New-Object System.Collections.Generic.List[string]
    if ([Vdb]::Dialogs($script:vda.Pid).Count) { $notes.Add('VietDA đang mở hộp thoại → KHÔNG xuất bảng kê (xử lý hộp thoại rồi chạy lại với -VerifyOnly)'); return $notes }
    if (-not (Close-ToolTabs)) { $notes.Add('phiếu đang mở còn dữ liệu / không Thoát được → KHÔNG xuất bảng kê; xử lý phiếu rồi chạy lại với -VerifyOnly'); return $notes }
    $groups = [ordered]@{}
    foreach ($m in $modes) {
        $p = Get-ModePrefix $m
        if (-not $p) { $notes.Add("[$m] chưa biết Loại chứng từ (tiền tố Số CT — tool nhớ sau lần đầu mở phiếu $m) → không xuất bảng kê"); continue }
        if (-not $groups.Contains($p)) { $groups[$p] = New-Object System.Collections.Generic.List[string] }
        $groups[$p].Add($m)
    }
    $listing = @{}
    $checked = @{}
    $inv = [Globalization.CultureInfo]::InvariantCulture
    foreach ($p in @($groups.Keys)) {
        $ms = $groups[$p]
        $tag = $ms -join '-'
        $dates = @(@(foreach ($t in $txns) {
            if (($ms -contains 'Thu' -and $t.Credit -gt 0) -or ($ms -contains 'Chi' -and $t.Debit -gt 0)) { [DateTime]::ParseExact($t.Date, 'dd/MM/yyyy', $inv) }
        }) | Sort-Object)
        if (-not $dates.Count) { $notes.Add("[$tag] sao kê không có GD → không xuất bảng kê"); continue }
        $from = $dates[0].ToString('dd/MM/yyyy', $inv)
        $to = $dates[-1].ToString('dd/MM/yyyy', $inv)
        Write-Log INFO "[$tag] Tìm kiếm chứng từ $p từ $from đến $to → Excel — KHÔNG đụng chuột/bàn phím..."
        try {
            $res = Export-Listing $p $from $to
            foreach ($x in $res.Rows) { $listing[$x.SoCt] = $x }
            foreach ($m in $ms) { $checked[$m] = $true }
            $msg = "[$tag] bảng kê VietDA $p $from → $to`: $($res.Rows.Count) phiếu$(if ($res.Info) { " ($($res.Info))" })"
            Write-Log OK $msg
            $notes.Add($msg)
        } catch {
            $msg = "[$tag] xuất bảng kê VietDA lỗi: $($_.Exception.Message) (dòng $($_.InvocationInfo.ScriptLineNumber))"
            Write-Log ERROR $msg
            $notes.Add($msg)
        }
    }
    foreach ($r in $script:rows) {
        if (-not $r.SoCt) { continue }
        if (-not $checked[$r.Mode]) { $r.Check = 'Chưa kiểm tra (không xuất được bảng kê)'; continue }
        $vd = $listing[$r.SoCt]
        if (-not $vd) { $r.Check = 'KHÔNG THẤY trên VietDA'; continue }
        $r.VdDate = $vd.Date; $r.VdName = $vd.Name; $r.VdReason = $vd.Reason; $r.VdAmount = $vd.Amount
        $bad = @()
        if ($vd.Date -ne $r.Date) { $bad += 'Ngày' }
        if ($vd.Amount -ne $r.Amount) { $bad += 'Số tiền' }
        if ($r.Reason -and (Squash $vd.Reason) -ne (Squash $r.Reason)) { $bad += 'Lý do' }
        if ($r.ObjectName -and (Normalize-Name $vd.Name) -ne (Normalize-Name $r.ObjectName)) { $bad += 'Đối tượng' }
        $r.Check = if ($bad.Count) { 'SAI: ' + ($bad -join ', ') } else { 'ĐÚNG' }
    }
    return $notes
}

$ReportCols = @(
    @('Loại', 'Mode'), @('Mã GD', 'Code'), @('Thời gian GD', 'DateTime'), @('Số tiền', 'Amount'), @('Diễn giải sao kê', 'Desc'),
    @('Đối tượng', 'Object'), @('Lý do', 'Reason'), @('Kết quả chạy', 'Result'), @('Số CT', 'SoCt'), @('Ghi chú', 'Note'),
    @('Nguồn', 'Source'), @('Lý do không lập', 'NoWhy'),
    @('Kiểm tra VietDA', 'Check'), @('Ngày (VietDA)', 'VdDate'), @('Họ tên (VietDA)', 'VdName'), @('Lý do (VietDA)', 'VdReason'), @('Số tiền (VietDA)', 'VdAmount'))

# Ô trạng thái tô màu (06/11/2026): xanh lá = đạt, đỏ = còn lại (bỏ qua, lỗi, SAI, KHÔNG THẤY, chưa chạy…)
$ColorCols = @('Result', 'Check')
$PassValues = '^(Thành công|ĐÚNG|Đã tạo ở lần chạy trước|Sẽ tạo \(DRY RUN\))$'
$NumberCols = @('Amount', 'VdAmount')

# .xlsx tự ghi (OOXML tối giản, không cần Excel — tránh lỗi định dạng số theo locale VN): dòng 1 tiêu đề đậm, cố định khi cuộn, có lọc;
# style 0 thường · 1 tiêu đề · 2 số #,##0 · 3 xanh lá · 4 đỏ
function Write-XlsxReport([string]$Path, [object[]]$Rows) {
    $esc = { param($s) [Security.SecurityElement]::Escape(([string]$s -replace '[\x00-\x08\x0B\x0C\x0E-\x1F]', '')) }
    $colName = { param($i) $s = ''; for ($n = $i + 1; $n -gt 0; $n = [Math]::Floor(($n - 1) / 26)) { $s = [char](65 + (($n - 1) % 26)) + $s }; $s }
    $cell = {
        param($ref, $v, [int]$style)
        if ($null -eq $v -or [string]$v -eq '') { return '' }
        if ($v -is [long] -or $v -is [int] -or $v -is [double]) { return "<c r=`"$ref`" s=`"$(if ($style) { $style } else { 2 })`"><v>$([Convert]::ToString($v, [Globalization.CultureInfo]::InvariantCulture))</v></c>" }
        $st = if ($style) { ' s="' + $style + '"' } else { '' }
        '<c r="' + $ref + '" t="inlineStr"' + $st + '><is><t xml:space="preserve">' + (& $esc $v) + '</t></is></c>'
    }
    $nCol = $ReportCols.Count
    $widths = @(for ($c = 0; $c -lt $nCol; $c++) {
        $p = $ReportCols[$c][1]
        $w = ([string]$ReportCols[$c][0]).Length + 2
        foreach ($r in $Rows | Select-Object -First 2000) { $l = ([string]$r.$p).Length + 2; if ($l -gt $w) { $w = $l } }
        [Math]::Min(60, [Math]::Max(8, $w))
    })
    $sb = New-Object Text.StringBuilder
    [void]$sb.Append('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">')
    [void]$sb.Append('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>')
    for ($c = 0; $c -lt $nCol; $c++) { [void]$sb.Append("<col min=`"$($c + 1)`" max=`"$($c + 1)`" width=`"$($widths[$c])`" customWidth=`"1`"/>") }
    [void]$sb.Append('</cols><sheetData><row r="1">')
    for ($c = 0; $c -lt $nCol; $c++) { [void]$sb.Append((& $cell "$(& $colName $c)1" $ReportCols[$c][0] 1)) }
    [void]$sb.Append('</row>')
    $i = 1
    foreach ($r in $Rows) {
        $i++
        [void]$sb.Append("<row r=`"$i`">")
        for ($c = 0; $c -lt $nCol; $c++) {
            $p = $ReportCols[$c][1]
            $v = $r.$p
            $style = 0
            if ($ColorCols -contains $p -and [string]$v) { $style = if ([string]$v -match $PassValues) { 3 } else { 4 } }
            if ($NumberCols -contains $p -and [string]$v -match '^-?\d+$') { $v = [long]$v }
            [void]$sb.Append((& $cell "$(& $colName $c)$i" $v $style))
        }
        [void]$sb.Append('</row>')
    }
    [void]$sb.Append("</sheetData><autoFilter ref=`"A1:$(& $colName ($nCol - 1))$i`"/></worksheet>")
    $parts = [ordered]@{
        '[Content_Types].xml' = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
        '_rels/.rels' = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
        'xl/workbook.xml' = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ket-qua" sheetId="1" r:id="rId1"/></sheets></workbook>'
        'xl/_rels/workbook.xml.rels' = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'
        'xl/styles.xml' = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF006100"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF9C0006"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC6EFCE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
        'xl/worksheets/sheet1.xml' = $sb.ToString()
    }
    if (Test-Path -LiteralPath $Path) { Remove-Item -LiteralPath $Path -Force }
    $fs = [IO.File]::Open($Path, [IO.FileMode]::CreateNew)
    $zip = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
    try {
        $utf8 = New-Object Text.UTF8Encoding($false)
        foreach ($k in $parts.Keys) {
            $w = New-Object IO.StreamWriter($zip.CreateEntry($k).Open(), $utf8)
            try { $w.Write($parts[$k]) } finally { $w.Dispose() }
        }
    } finally { $zip.Dispose(); $fs.Dispose() }
}

# ket-qua-chay.xlsx (ô Kết quả chạy / Kiểm tra VietDA tô xanh lá / đỏ); tóm tắt ghi tom-tat.txt
function Write-Report([string]$Path, $Summary) {
    if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }
    $inv = [Globalization.CultureInfo]::InvariantCulture
    $rows = @($script:rows | Sort-Object @{ e = { [Array]::IndexOf([string[]]$modes, $_.Mode) } }, @{ e = { [DateTime]::ParseExact($_.DateTime, 'dd/MM/yyyy HH:mm:ss', $inv) } })
    try { Write-XlsxReport $Path $rows }
    catch {
        # không ghi được .xlsx (file đang mở…) → vẫn để lại CSV để không mất kết quả
        $csv = [IO.Path]::ChangeExtension($Path, '.csv')
        Write-Log ERROR "Ghi $(Split-Path $Path -Leaf) lỗi: $($_.Exception.Message) → ghi tạm $(Split-Path $csv -Leaf)"
        $sel = @($ReportCols | ForEach-Object { $p = $_[1]; @{ n = $_[0]; e = [scriptblock]::Create("`$_.$p") } })
        $rows | Select-Object $sel | Export-Csv -LiteralPath $csv -Delimiter ';' -NoTypeInformation -Encoding UTF8
        $Path = $csv
    }
    $sumFile = Join-Path $OutDir 'tom-tat.txt'
    @($Summary.Keys | ForEach-Object { "{0}: {1}" -f $_, $Summary[$_] }) | Set-Content -LiteralPath $sumFile -Encoding UTF8
    Write-Log OK "Kết quả chạy → $Path ($($rows.Count) dòng) + $(Split-Path $sumFile -Leaf)"
}

# ================= main =================
$startedAt = Get-Date
Write-Log INFO "===== Bắt đầu$(if ($DryRun) { ' (DRY RUN)' } elseif ($VerifyOnly) { ' (-VerifyOnly: không tạo phiếu, chỉ xuất bảng kê + kiểm tra)' })"
if ($fontNote) { Write-Log WARN "$fontNote — tiếng Việt có thể hiện thành '?' (chuột phải thanh tiêu đề → Properties → Font → Consolas); file log vẫn đúng." }

$script:vda = Find-Vietda
if (-not $script:vda) { Fail 'Không thấy VietDA đã đăng nhập (Menu.exe) — mở VietDA, đăng nhập rồi chạy lại.' }
if ([Vdb]::Dialogs($script:vda.Pid).Count) { Fail 'VietDA đang mở hộp thoại — đóng nó rồi chạy lại.' }
Close-SearchDialog
$modes = @(if ($Mode) { $Mode } else { 'Thu'; 'Chi' })

# Sao kê + đối soát: lấy hết trong Input\ (hoặc -Statement / -Recon); chỉ hỏi thư mục XML
# .xlsx trong Input: có sheet Nhap-VietDA → Excel Đối soát CK; "DANH MỤC ĐỐI TƯỢNG" của VietDA → danh mục; còn lại → sao kê TPBank
$xlsxRows = @{}
$objectLists = New-Object System.Collections.Generic.List[string]
$statements = New-Object System.Collections.Generic.List[string]
$reconXlsx = New-Object System.Collections.Generic.List[string]
$inputXlsx = if ($Statement) { @(Get-ChildItem -LiteralPath $InputDir -File -Filter *.xlsx -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '~$*' } | ForEach-Object { $_.FullName }) } else { @(Get-InputFiles '.xlsx' 'sao kê TPBank (.xlsx)') }
foreach ($f in $inputXlsx) {
    try { $isRecon = Test-ReconXlsx $f } catch { Fail "Đọc $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)" }
    if ($isRecon) { if (-not $Recon) { $reconXlsx.Add($f) }; continue }
    try { $xlsxRows[$f] = Read-XlsxRows $f } catch { Fail "Đọc $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)" }
    if (Test-ObjectList $xlsxRows[$f]) { $objectLists.Add($f) } elseif (-not $Statement) { $statements.Add($f) }
}
if ($Statement) {
    try { $xlsxRows[$Statement] = Read-XlsxRows $Statement } catch { Fail "Đọc $(Split-Path $Statement -Leaf) lỗi: $($_.Exception.Message)" }
    $statements.Add($Statement)
}
if ($statements.Count -eq 0) { Start-Process explorer.exe $InputDir; Fail "Chưa có sao kê TPBank (.xlsx) trong $InputDir — copy file vào thư mục vừa mở rồi chạy lại." }
# CSV doi-soat-ck_*.csv cũ: vẫn nhận một thời gian (fallback), Excel có Mã GD nào thì Excel thắng
$reconCsv = New-Object System.Collections.Generic.List[string]
if ($Recon) {
    if ([IO.Path]::GetExtension($Recon) -eq '.xlsx') { $reconXlsx.Add($Recon) } else { $reconCsv.Add($Recon) }
} else {
    foreach ($f in @(Get-ChildItem -LiteralPath $InputDir -File -Filter *.csv -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq '.csv' -and $_.Name -notlike '~$*' } | Sort-Object Name)) { $reconCsv.Add($f.FullName) }
}
if ($modes -contains 'Thu' -and $reconXlsx.Count -eq 0 -and $reconCsv.Count -eq 0) {
    Start-Process explorer.exe $InputDir
    Fail "Chưa có file Đối soát CK trong $InputDir — trên KeToan trang Đối soát CK bấm Xuất Excel (doi-soat-ck_<từ>_<đến>.xlsx), copy vào thư mục vừa mở rồi chạy lại."
}
$recons = @($reconXlsx) + @($reconCsv)
foreach ($p in $statements + $recons) { if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Fail "Không thấy file: $p" } }
if (-not $XmlFolder) { $XmlFolder = Find-XmlFolder }
if ($XmlFolder -and -not (Test-Path -LiteralPath $XmlFolder -PathType Container)) { Fail "Không thấy thư mục: $XmlFolder" }

$txns = New-Object System.Collections.Generic.List[object]
$seenTxn = @{}
foreach ($f in $statements) {
    try { $part = @(Read-Statement $xlsxRows[$f]) } catch { Fail "Đọc sao kê $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)" }
    $dup = 0
    foreach ($t in $part) {
        $k = if ($t.Code) { $t.Code } else { "$($t.DateTime)|$($t.Debit)|$($t.Credit)|$($t.Desc)" }
        if ($seenTxn.ContainsKey($k)) { $dup++; continue }
        $seenTxn[$k] = $true
        $txns.Add($t)
    }
    Write-Log INFO "Sao kê $(Split-Path $f -Leaf): $($part.Count) GD, Ghi có $(@($part | Where-Object { $_.Credit -gt 0 }).Count), Ghi nợ $(@($part | Where-Object { $_.Debit -gt 0 }).Count)$(if ($dup) { ", $dup GD trùng file khác (bỏ)" })."
    if ($part.Count -eq 0) { Write-Log WARN "Sao kê $(Split-Path $f -Leaf) không có GD nào — có đúng file sao kê TPBank (.xlsx) không?" }
}
# Excel đối soát: Mã GD → dòng Nhap-VietDA (nhiều file gộp, trùng Mã GD lấy file đầu)
$reconX = @{}
foreach ($f in $reconXlsx) {
    try { $part = Read-ReconXlsx $f } catch { Fail "Đọc Excel đối soát $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)" }
    $dup = 0
    foreach ($k in $part.Keys) { if ($reconX.ContainsKey($k)) { $dup++ } else { $reconX[$k] = $part[$k] } }
    $v = @($part.Values)
    $cnt = { param($m, $mk) @($v | Where-Object { $_.Mode -eq $m -and (-not $mk -or $_.Make) }).Count }
    Write-Log INFO "Excel đối soát $(Split-Path $f -Leaf) ($ReconSchema): Thu $(& $cnt 'Thu' $false) GD (lập phiếu theo HĐ $(& $cnt 'Thu' $true)), Chi $(& $cnt 'Chi' $false) GD (lập phiếu theo HĐ $(& $cnt 'Chi' $true))$(if ($dup) { ", $dup Mã GD trùng file khác (bỏ)" })."
}
# CSV cũ (chỉ phiếu thu dùng): Mã GD → số HĐĐT
$reconMap = @{}
foreach ($f in $reconCsv) {
    try { $part = Read-Recon $f } catch { Fail "Đọc CSV đối soát $(Split-Path $f -Leaf) lỗi: $($_.Exception.Message)" }
    foreach ($k in $part.Keys) { if (-not $reconMap.ContainsKey($k)) { $reconMap[$k] = $part[$k] } }
    Write-Log WARN "CSV đối soát $(Split-Path $f -Leaf): $($part.Count) Mã GD — định dạng cũ, sắp bỏ; dùng Excel từ trang Đối soát CK (Xuất Excel)$(if ($reconXlsx.Count) { '. Mã GD có trong Excel thì lấy theo Excel' })."
}
# MST công ty = MST có mặt trong nhiều XML nhất (người mua của HĐ mua vào, người bán của HĐ bán ra)
$xmls = @(Read-InvoiceXml $XmlFolder)
$mstCount = @{}
foreach ($x in $xmls) { foreach ($m in @($x.SellerMst, $x.BuyerMst) | Where-Object { $_ } | Select-Object -Unique) { $mstCount[$m] = 1 + [int]$mstCount[$m] } }
$ownMst = [string](@($mstCount.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1 | ForEach-Object { $_.Key }) + @(''))[0]
$purchases = @($xmls | Where-Object { $_.SellerMst -ne $ownMst })
$sales = @($xmls | Where-Object { $ownMst -and $_.SellerMst -eq $ownMst })
Write-Log INFO "Thư mục XML $XmlFolder`: $($xmls.Count) hóa đơn — MST công ty $ownMst ($([int]$mstCount[$ownMst]) XML): mua vào $($purchases.Count), bán ra $($sales.Count)."
if ($xmls.Count -and [int]$mstCount[$ownMst] -lt $xmls.Count) { Write-Log WARN "$($xmls.Count - [int]$mstCount[$ownMst]) XML không có MST công ty $ownMst (của công ty khác?) — tính là mua vào" }
if ($modes -contains 'Thu' -and $sales.Count -eq 0) { Write-Log WARN 'Không có XML hóa đơn bán ra → mọi GD ghi có sẽ bị bỏ qua (cần XML bán ra để biết người mua)' }

$manualMap = @{}
if (Test-Path -LiteralPath $MapFile) {
    foreach ($line in Get-Content -LiteralPath $MapFile -Encoding UTF8) {
        $parts = $line -split '[;,\t]'
        # MST;Mã  hoặc  MST;Mã;Thu|Chi (cùng MST khác mã cho phiếu thu / phiếu chi)
        if ($parts.Count -ge 2 -and $parts[0].Trim() -match '^\d') {
            $k = $parts[0].Trim()
            if ($parts.Count -ge 3 -and $parts[2].Trim() -match '^(Thu|Chi)$') { $k = "$($parts[2].Trim())|$k" }
            $manualMap[$k] = $parts[1].Trim()
        }
    }
}
# sổ: Khóa \t Số CT \t Số tiền \t Lý do \t Giờ tạo
$done = @{}
if ((Test-Path -LiteralPath $LedgerFile) -and -not $Force) {
    foreach ($line in Get-Content -LiteralPath $LedgerFile -Encoding UTF8) { $parts = $line -split "`t"; if ($parts[0]) { $done[$parts[0]] = $parts } }
}

# Danh mục Đối tượng: file VietDA xuất "DANH MỤC ĐỐI TƯỢNG" (vd DANH SACH.xlsx) kế toán bỏ vào Input — mã, tên, MST chính xác.
# (Bỏ OCR list Đối tượng trên phiếu từ 05/11/2026: chậm, phải mở phiếu, OCR sai MST.)
if (-not $objectLists.Count) {
    Start-Process explorer.exe $InputDir
    Fail "Chưa có danh mục Đối tượng trong $InputDir — trên VietDA xuất danh mục Đối tượng ra Excel (file có dòng 'DANH MỤC ĐỐI TƯỢNG', vd DANH SACH.xlsx), copy vào thư mục vừa mở rồi chạy lại."
}
$listFile = @($objectLists | Sort-Object { (Get-Item -LiteralPath $_).LastWriteTime } -Descending)[0]
if ($objectLists.Count -gt 1) { Write-Log WARN "Có $($objectLists.Count) file danh mục Đối tượng trong Input — dùng file mới nhất $(Split-Path $listFile -Leaf)" }
try { $objects = @(Read-ObjectList $xlsxRows[$listFile]) } catch { Fail "Đọc danh mục Đối tượng $(Split-Path $listFile -Leaf) lỗi: $($_.Exception.Message)" }
if ($objects.Count -eq 0) { Fail "Danh mục Đối tượng $(Split-Path $listFile -Leaf) không có mã nào." }
Write-Log INFO "Danh mục Đối tượng: $($objects.Count) mã từ $(Split-Path $listFile -Leaf) (có MST $(@($objects | Where-Object { $_.Mst }).Count) mã)."
foreach ($o in $objects) { $script:objByCode[$o.Code] = $o.Name }

# Phiếu thu HĐ không có MST người mua → -RetailObject (mặc định KH010 "Bán cho người tiêu dùng" — kế toán SONG MINH hay dùng).
# Mã đó tên không phải kiểu khách lẻ (mở nhầm file dữ liệu?) → cảnh báo, tìm theo tên ("Bán cho người tiêu dùng" rồi "Khách lẻ…"); không gán nhầm.
$RetailNames = '^(BAN CHO NGUOI TIEU DUNG|NGUOI MUA KHONG LAY HOA DON|KHACH LE)\b'
$retailCode = ''
$retailWhy = ''
if ($true) {
    $given = @($objects | Where-Object { $_.Code -eq $RetailObject })
    if ($RetailObject -and (-not $objects.Count -or ($given.Count -and $given[0].Norm -match $RetailNames))) {
        $retailCode = $RetailObject
    } else {
        if ($RetailObject) { Write-Log WARN "Mã khách lẻ $RetailObject $(if ($given.Count) { "trong danh mục là '$($given[0].Name)', không phải khách lẻ" } else { 'không có trong danh mục' }) — tìm theo tên" }
        $kl = @($objects | Where-Object { $_.Norm -eq 'BAN CHO NGUOI TIEU DUNG' })
        if ($kl.Count -ne 1) { $kl = @($objects | Where-Object { $_.Norm -match '^KHACH LE\b' }) }
        if ($kl.Count -eq 1) { $retailCode = $kl[0].Code }
        else { $retailWhy = "HĐ không có MST người mua nhưng $(if ($kl.Count) { "có $($kl.Count) mã tên 'Khách lẻ' ($(($kl | ForEach-Object { $_.Code }) -join ', '))" } else { "không thấy đối tượng tên bắt đầu bằng 'Khách lẻ'" }) — chạy với -RetailObject <mã>" }
    }
    Write-Log INFO "Đối tượng Khách lẻ (HĐ không có MST người mua): $(if ($retailCode) { "$retailCode $($script:objByCode[$retailCode])" } else { "CHƯA XÁC ĐỊNH — $retailWhy" })"
}

$NotRun = 'Chưa chạy (tool dừng trước)'
function Build-Queue([string]$M) {
    $queue = New-Object System.Collections.Generic.List[object]
    $skipped = New-Object System.Collections.Generic.List[string]
    $skippedLedger = 0
    $side = if ($M -eq 'Thu') { @($txns | Where-Object { $_.Credit -gt 0 }) } else { @($txns | Where-Object { $_.Debit -gt 0 }) }
    foreach ($t in $side) {
        $key = if ($t.Code) { "$M|$($t.Code)" } else { "$M|$($t.DateTime)|$($t.Debit + $t.Credit)|$($t.Desc)" }
        # dòng Excel đối soát của GD (nếu có) → cột Nguồn / Lý do không lập của ket-qua-chay.xlsx
        $er = if ($t.Code -and $reconX.ContainsKey($t.Code)) { $reconX[$t.Code] } else { $null }
        $script:rowNoWhy = if ($er -and -not $er.Make) { $er.NoWhy } else { '' }
        $script:rowSource = if ($er) { 'Excel' } elseif ($M -eq 'Thu' -and $t.Code -and $reconMap.ContainsKey($t.Code)) { 'CSV cũ' } elseif ($M -eq 'Chi') { 'Diễn giải + XML (cũ)' } else { '' }
        if ($done.ContainsKey($key)) {
            $skippedLedger++
            $l = @($done[$key]) + @('', '', '', '', '')
            [void](Add-Row $M $t 'Đã tạo ở lần chạy trước' $l[1] '' $l[3] ("sổ $(Split-Path $LedgerFile -Leaf) $($l[4])".Trim()))
            continue
        }
        $label = "$($t.DateTime) $('{0:N0}' -f ($t.Debit + $t.Credit)) $($t.Code)"
        $kind = Get-OtherKind $M $t
        if ($kind) {
            $script:rowSource = 'Luật khác'
            $code = if ($kind.Object -eq 'RETAIL') { $retailCode } else { $kind.Object }
            $who = ''
            if ($kind.Person) {
                $text = ' ' + (Normalize-Name "$($t.Desc) $($t.Counterparty)") + ' '
                $people = @($objects | Where-Object { $_.Code -like "$($kind.Person)*" -and $_.Norm -and $text.Contains(" $($_.Norm) ") })
                if ($people.Count -eq 1) { $code = $people[0].Code; $who = " · nhân viên $($people[0].Name)" }
                elseif ($people.Count -gt 1) { $who = " · nhiều nhân viên trùng tên ($(($people | ForEach-Object { $_.Code }) -join ', ')) → $code" }
                else { $who = " · không thấy tên nhân viên $($kind.Person)… → $code" }
            }
            $why = if (-not $code) { $retailWhy } elseif ($objects.Count -and -not $script:objByCode.ContainsKey($code)) { "mã đối tượng $code ($($kind.Name)) không có trong danh mục VietDA" } else { '' }
            if ($why) {
                $skipped.Add("$label — $($kind.Name): $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note "$($kind.Name): $why")
                continue
            }
            $note = "$($kind.Name) · Nợ $($kind.Debit) / Có $($kind.Credit)$who"
            if ($er -and $er.Make) {
                $note += " · Excel đối soát ghi lập theo HĐ $($er.Numbers -join ', ') — ưu tiên luật '$($kind.Name)'"
                Write-Log WARN "[$M] $label — nội dung khớp luật '$($kind.Name)' nhưng Excel đối soát ghi lập phiếu theo HĐ $($er.Numbers -join ', ') → theo luật, kiểm lại"
            }
            $row = Add-Row $M $t $NotRun '' $code $kind.Reason $note
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Debit + $t.Credit; Object = $code; Reason = $kind.Reason; Label = $label; Note = $note; Row = $row; Debit = $kind.Debit; Credit = $kind.Credit })
            continue
        }
        # Excel đối soát: kiểm khớp sao kê rồi "Lập phiếu theo HĐ" = Không → không lập (đã qua luật khác ở trên)
        if ($er) {
            $amt = $t.Debit + $t.Credit
            $why = if ($er.Mode -ne $M) { "Excel đối soát ghi Loại=$($er.Mode) nhưng sao kê là $(if ($M -eq 'Thu') { 'Ghi có' } else { 'Ghi nợ' })" }
                elseif ($er.Amount -and $er.Amount -ne $amt) { "Số tiền trên Excel đối soát $('{0:N0}' -f $er.Amount) ≠ sao kê $('{0:N0}' -f $amt) (Excel của sao kê khác?)" }
                elseif (-not $er.Make) { "không lập theo HĐ: $(if ($er.NoWhy) { $er.NoWhy } else { 'Excel không ghi lý do' })$(if ($er.Match) { " ($($er.Match))" })" }
                else { '' }
            if ($why) {
                $skipped.Add("$label — $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                continue
            }
        }
        if ($M -eq 'Thu') {
            if ($er) {
                # Số HĐĐT + ký hiệu từ Excel (ký hiệu: cùng số lượng → ghép theo thứ tự; 1 ký hiệu → dùng chung)
                $inv = @(for ($j = 0; $j -lt $er.Numbers.Count; $j++) {
                    [pscustomobject]@{ Number = $er.Numbers[$j]; Serial = $(if ($er.Serials.Count -eq $er.Numbers.Count) { $er.Serials[$j] } elseif ($er.Serials.Count -eq 1) { $er.Serials[0] } else { '' }) }
                })
                if ($inv.Count -eq 0) {
                    $why = 'Excel đối soát ghi lập phiếu theo HĐ nhưng thiếu Số HĐ'
                    $skipped.Add("$label — $why")
                    [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                    continue
                }
            } else {
                $inv = if ($t.Code -and $reconMap.ContainsKey($t.Code)) { @($reconMap[$t.Code] | Where-Object { $_.Number }) } else { @() }
            }
            if ($inv.Count -eq 0) {
                $why = if ($t.Code -and $reconMap.ContainsKey($t.Code)) { "chưa có số HĐĐT ($(($reconMap[$t.Code] | ForEach-Object { "$($_.Kind) $($_.Code)".Trim() }) -join ', '))" } else { "không có trong file đối soát$(if ($reconX.Count) { ' Excel' }) (GD thừa / khác ngày?)" }
                $skipped.Add("$label — $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                continue
            }
            # người mua: XML bán ra cùng Số HĐĐT (+ ký hiệu); không có MST → Khách lẻ; có MST → mã theo danh mục
            $why = ''
            $buyers = New-Object System.Collections.Generic.List[object]
            foreach ($ri in @($inv | Sort-Object Serial, Number -Unique)) {
                $n = 0L
                if (-not [long]::TryParse($ri.Number, [ref]$n)) { $why = "số HĐĐT '$($ri.Number)' không hợp lệ"; break }
                $c = @($sales | Where-Object { $_.Number -eq $n -and (-not $ri.Serial -or $_.Serial -eq $ri.Serial) })
                if ($c.Count -eq 0) { $why = "không có XML HĐ bán ra số $n$(if ($ri.Serial) { " ký hiệu $($ri.Serial)" }) trong thư mục XML"; break }
                if ($c.Count -gt 1) { $why = "có $($c.Count) XML HĐ bán ra cùng số $n ($(($c | ForEach-Object { $_.File }) -join ', '))"; break }
                $buyers.Add($c[0])
            }
            if (-not $why) {
                $bm = @($buyers | ForEach-Object { [string]$_.BuyerMst } | Select-Object -Unique)
                if ($bm.Count -gt 1) { $why = "các HĐ thuộc nhiều người mua ($(($bm | ForEach-Object { if ($_) { $_ } else { 'khách lẻ' } }) -join ', '))" }
            }
            $objCode = ''
            $note = ''
            if (-not $why) {
                $b = $buyers[0]
                if (-not $b.BuyerMst) {
                    if ($retailCode) { $objCode = $retailCode; $note = "khách lẻ ($(@($b.BuyerPerson, $b.BuyerName, 'không ghi tên') | Where-Object { $_ } | Select-Object -First 1))" } else { $why = $retailWhy }
                } else {
                    $obj = Resolve-Object $b.BuyerMst $b.BuyerName $objects $manualMap 'Thu'
                    if ($obj.Error) { $why = "người mua $($b.BuyerName): $($obj.Error)" } else { $objCode = $obj.Code; $note = "$($b.BuyerName) [mã theo $($obj.By)]" }
                }
            }
            if ($why) {
                $skipped.Add("$label — $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                continue
            }
            # ngày HĐ: NLap trong XML bán ra (cùng XML lấy người mua)
            $reason = Format-InvoiceRef 'Thu' @($buyers | Sort-Object Number -Unique | ForEach-Object { @{ Number = $_.Number; Date = $_.Date } })
            $row = Add-Row $M $t $NotRun '' $objCode $reason $note
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Credit; Object = $objCode; Reason = $reason; Label = $label; Note = $note; Row = $row })
        } elseif ($er) {
            # Chi theo Excel đối soát: Số HĐ + MST đối tác đã ghép ở trang Đối soát CK (không đoán "HD <số>" trong diễn giải)
            $why = if ($er.Numbers.Count -eq 0) { 'Excel đối soát ghi lập phiếu theo HĐ nhưng thiếu Số HĐ' }
                elseif ($er.Msts.Count -eq 0) { "Excel đối soát thiếu MST đối tác (HĐ $($er.Numbers -join ', '))" }
                elseif ($er.Msts.Count -gt 1) { "các HĐ thuộc nhiều người bán ($($er.Msts -join ', '))" }
                else { '' }
            if (-not $why) {
                $obj = Resolve-Object $er.Msts[0] $er.Name $objects $manualMap 'Chi'
                if ($obj.Error) { $why = "người bán $($er.Name): $($obj.Error)" }
            }
            if ($why) {
                $skipped.Add("$label '$($t.Desc)' — $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                continue
            }
            $note = "$($er.Name) [Excel đối soát: $($er.Match)$(if ($er.Confidence) { ", tin cậy $($er.Confidence)" }), mã theo $($obj.By)]$(if ($er.Total -and $er.Total -ne $t.Debit) { " · tổng HĐ $('{0:N0}' -f $er.Total) ≠ số tiền CK" })"
            # ngày HĐ theo cột Ngày HĐ của Excel: cùng số lượng → ghép theo thứ tự; 1 ngày → dùng chung; lệch → nối sau
            $refs = if ($er.Dates.Count -eq $er.Numbers.Count -or $er.Dates.Count -le 1) {
                    @(for ($j = 0; $j -lt $er.Numbers.Count; $j++) { @{ Number = $er.Numbers[$j]; Date = $(if ($er.Dates.Count -eq $er.Numbers.Count) { $er.Dates[$j] } elseif ($er.Dates.Count) { $er.Dates[0] } else { '' }) } })
                } else { $null }
            $reason = if ($refs) { Format-InvoiceRef 'Chi' $refs } else { $ReasonPrefix.Chi + ($er.Numbers -join ', ') + ' ngày ' + ($er.Dates -join ', ') }
            $row = Add-Row $M $t $NotRun '' $obj.Code $reason $note
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Debit; Object = $obj.Code; Reason = $reason; Label = $label; Note = $note; Row = $row })
        } else {
            # không có dòng Excel đối soát (chỉ có CSV cũ / không có file) → logic cũ: "HD <số>" trong diễn giải + XML mua vào
            if ($reconX.Count) { Write-Log WARN "[$M] $label — không có trong Excel đối soát, khớp HĐ theo diễn giải + XML (cách cũ)" }
            $hit = Find-DebitInvoices $t $purchases
            $why = if ($hit.Error) { $hit.Error } else { '' }
            if (-not $why) {
                $sellers = @($hit.Invoices | ForEach-Object { $_.SellerMst } | Select-Object -Unique)
                if ($sellers.Count -gt 1) { $why = "các HĐ thuộc nhiều người bán ($($sellers -join ', '))" }
            }
            if (-not $why) {
                $first = $hit.Invoices[0]
                $obj = Resolve-Object $first.SellerMst $first.SellerName $objects $manualMap 'Chi'
                if ($obj.Error) { $why = $obj.Error }
            }
            if ($why) {
                $skipped.Add("$label '$($t.Desc)' — $why")
                [void](Add-Row $M $t 'Bỏ qua' -Note $why)
                continue
            }
            $sum = ($hit.Invoices | Measure-Object Total -Sum).Sum
            $note = "$($first.SellerName) [khớp HĐ theo $($hit.By), mã theo $($obj.By)]$(if ($sum -ne $t.Debit) { " · LỆCH: tổng HĐ $('{0:N0}' -f $sum)" })"
            $reason = Format-InvoiceRef 'Chi' @($hit.Invoices | ForEach-Object { @{ Number = $_.Number; Date = $_.Date } })
            $row = Add-Row $M $t $NotRun '' $obj.Code $reason $note
            $queue.Add([pscustomobject]@{ Key = $key; Date = $t.Date; Amount = $t.Debit; Object = $obj.Code; Reason = $reason; Label = $label; Note = $note; Row = $row })
        }
    }
    if ($skippedLedger) { Write-Log INFO "[$M] Bỏ qua $skippedLedger GD đã tạo phiếu ở lần chạy trước ($(Split-Path $LedgerFile -Leaf); -Force để làm lại)." }
    foreach ($s in $skipped) { Write-Log WARN "[$M] Không tạo phiếu: $s" }
    if ($Limit -gt 0 -and $queue.Count -gt $Limit) {
        foreach ($x in @($queue | Select-Object -Skip $Limit)) { $x.Row.Result = 'Chưa chạy (-Limit)' }
        $queue = @($queue | Select-Object -First $Limit)
    }
    Write-Log INFO "[$M] Sẽ tạo $($queue.Count) phiếu$(if ($Limit -gt 0) { " (-Limit $Limit)" }), bỏ qua $($skipped.Count) GD."
    $i = 0
    foreach ($q in $queue) { $i++; Write-Log INFO ("  [{0}] {1} → {2} | {3}{4}" -f $i, $q.Label, $q.Object, $q.Reason, $(if ($q.Note) { " | $($q.Note)" })) }
    $arr = [object[]]@(foreach ($x in $queue) { $x })
    return , $arr
}

$queues = @{}
foreach ($m in $modes) { $queues[$m] = Build-Queue $m }
$total = ($modes | ForEach-Object { $queues[$_].Count } | Measure-Object -Sum).Sum

$create = $total -gt 0 -and -not $DryRun -and -not $VerifyOnly
$runMode = 'Chạy thật'
if ($DryRun) { $runMode = 'DRY RUN'; foreach ($r in $script:rows) { if ($r.Result -eq $NotRun) { $r.Result = 'Sẽ tạo (DRY RUN)' } } }
elseif ($VerifyOnly) { $runMode = '-VerifyOnly'; foreach ($r in $script:rows) { if ($r.Result -eq $NotRun) { $r.Result = 'Chưa tạo (-VerifyOnly)' } } }
if ($create -and -not $Yes) {
    $answer = Read-Host "Tạo $total phiếu ($(($modes | ForEach-Object { "$_ $($queues[$_].Count)" }) -join ', ')) rồi xuất bảng kê VietDA ra Excel? Tool sẽ chiếm chuột/bàn phím, KHÔNG đụng vào máy tới khi xong. Gõ Y rồi Enter"
    if ($answer -notmatch '^[yY]$') { Write-Log INFO '===== Không đồng ý — chưa tạo phiếu nào.'; exit 0 }
}

$ok = 0
$stopped = $false
if ($create) {
    foreach ($m in $modes) {
        $queue = $queues[$m]
        if ($queue.Count -eq 0) { continue }
        try {
            $script:vda = Open-Form $m
            $script:ctl = Get-Controls $script:vda.Form
            Save-Prefix $m
        } catch { Write-Log ERROR "[$m] DỪNG: không mở được phiếu: $($_.Exception.Message)"; $queue[0].Row.Note = "không mở được phiếu: $($_.Exception.Message)"; $stopped = $true; break }
        $i = 0
        foreach ($q in $queue) {
            $i++
            $sw = [Diagnostics.Stopwatch]::StartNew()
            try { $result = Invoke-Voucher $q } catch { $result = New-Result FATAL $_.Exception.Message }
            if ($result.Status -eq 'NOSAVE') { $q.Row.Result = 'Đã điền, KHÔNG Lưu (-NoSave)'; $q.Row.Note = $result.Message; Write-Log WARN "[$m] $($q.Label) — $($result.Message)"; $stopped = $true; break }
            if ($result.Status -ne 'OK') {
                $q.Row.Result = 'Lỗi'
                $q.Row.Note = (@($q.Row.Note, $result.Message) | Where-Object { $_ }) -join ' | '
                Write-Log ERROR "[$m $i/$($queue.Count)] $($q.Label) — DỪNG: $($result.Message)"
                $stopped = $true
                break
            }
            $ok++
            $q.Row.Result = 'Thành công'
            $q.Row.SoCt = $result.Message
            Add-Content -LiteralPath $LedgerFile -Value ("{0}`t{1}`t{2}`t{3}`t{4:yyyy-MM-dd HH:mm:ss}" -f $q.Key, $result.Message, $q.Amount, $q.Reason, (Get-Date)) -Encoding UTF8
            Write-Log OK ("[$m $i/$($queue.Count)] $($result.Message) — $($q.Label) → $($q.Object) | $($q.Reason) ({0:N1}s)" -f $sw.Elapsed.TotalSeconds)
        }
        if ($stopped) { break }
    }
    Write-Log INFO "===== Tạo xong $ok/$total phiếu$(if ($stopped) { ' (DỪNG giữa chừng)' })."
} elseif ($DryRun) { Write-Log INFO '===== DRY RUN xong, chưa tạo phiếu nào.' }
elseif ($total -eq 0) { Write-Log INFO '===== Không có phiếu nào cần tạo.' }

$verifyNotes = @()
if ($DryRun) { $verifyNotes = @('DRY RUN — không xuất bảng kê VietDA'); Close-ToolTabs | Out-Null }
elseif ($NoVerify) { $verifyNotes = @('-NoVerify — không xuất bảng kê VietDA'); Close-ToolTabs | Out-Null }
else { $verifyNotes = @(Invoke-Verify) }

$countBy = { param($prop) (@($script:rows | Where-Object { $_.$prop } | Group-Object $prop | ForEach-Object { "$($_.Name): $($_.Count)" }) -join '; ') }
$summary = [ordered]@{
    'Thời gian chạy' = $startedAt.ToString('dd/MM/yyyy HH:mm:ss')
    'Chế độ' = "$runMode · $($modes -join ' + ')$(if ($Limit -gt 0) { " · -Limit $Limit" })"
    'Sao kê' = ($statements | ForEach-Object { Split-Path $_ -Leaf }) -join ', '
    'File đối soát' = ($recons | ForEach-Object { "$(Split-Path $_ -Leaf)$(if ($_ -like '*.csv') { ' (CSV cũ)' })" }) -join ', '
    'Nguồn' = (& $countBy 'Source')
    'Thư mục XML' = [string]$XmlFolder
    'Kết quả chạy' = (& $countBy 'Result')
    'Kiểm tra VietDA' = (& $countBy 'Check')
    'Bảng kê VietDA' = ($verifyNotes -join ' | ')
    'Log' = $LogFile
}
Write-Log INFO "Kết quả chạy: $($summary['Kết quả chạy'])$(if ($summary['Kiểm tra VietDA']) { " · Kiểm tra VietDA: $($summary['Kiểm tra VietDA'])" })"
Write-Report (Join-Path $OutDir 'ket-qua-chay.xlsx') $summary
if (Test-Path -LiteralPath $OutDir) { Start-Process explorer.exe $OutDir }

Write-Log INFO "===== Kết thúc → $OutDir"
if ($stopped) { exit 2 }
exit 0
