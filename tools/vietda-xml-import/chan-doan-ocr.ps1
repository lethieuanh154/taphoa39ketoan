<#
  Chẩn đoán OCR VietDA — chạy trên máy báo lỗi "OCR không thấy menu 'Thu chi'" (hoặc không đọc được MST / mục menu).
  Bước 1 chỉ ĐỌC: thông tin màn hình (Scale), ngôn ngữ OCR, cửa sổ VietDA, chụp + OCR thanh menu theo nhiều cách.
  Bước 2 (chỉ khi gõ Y): bấm menu "Thu chi" 1 lần, chụp + OCR menu xổ xuống, rồi Esc — không mở phiếu, không sửa dữ liệu.
  Kết quả: VietDA-chan-doan-<máy>-<giờ>.zip trên Desktop → gửi lại cho người hỗ trợ.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
Add-Type -AssemblyName System.Windows.Forms, System.Drawing, System.Runtime.WindowsRuntime

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class VdDiag {
    public delegate bool EnumProc(IntPtr h, IntPtr l);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct FONT { public uint cbSize; public uint nFont; public short X; public short Y; public uint Family; public uint Weight;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Face; }
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc p, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, StringBuilder l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll")] static extern bool GetCurrentConsoleFontEx(IntPtr h, bool max, ref FONT i);
    [DllImport("kernel32.dll")] static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FONT i);
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int x, int y, uint d, IntPtr e);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport("gdi32.dll")] static extern int GetDeviceCaps(IntPtr dc, int i);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetWindowDpiAwarenessContext(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetThreadDpiAwarenessContext();
    [DllImport("user32.dll")] static extern int GetAwarenessFromDpiAwarenessContext(IntPtr c);

    public static List<IntPtr> Tops(uint pid) {
        var list = new List<IntPtr>();
        EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid) list.Add(h); return true; }, IntPtr.Zero);
        return list;
    }
    public static List<IntPtr> Descendants(IntPtr top) { var list = new List<IntPtr>(); EnumChildWindows(top, (h, l) => { list.Add(h); return true; }, IntPtr.Zero); return list; }
    public static string ClassOf(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, 256); return s.ToString(); }
    public static string TextOf(IntPtr h) { var s = new StringBuilder(512); IntPtr r; SendMessageTimeout(h, 0x000D, (IntPtr)512, s, 2, 1000, out r); return s.ToString(); }
    public static int[] Rect(IntPtr h) { RECT r; GetWindowRect(h, out r); return new int[] { r.L, r.T, r.R, r.B }; }
    public static bool Activate(IntPtr h) {
        if (IsIconic(h)) ShowWindow(h, 9);
        IntPtr fg = GetForegroundWindow(); uint p;
        uint ft = GetWindowThreadProcessId(fg, out p), me = GetCurrentThreadId();
        if (ft != me) AttachThreadInput(me, ft, true);
        BringWindowToTop(h); SetForegroundWindow(h);
        if (ft != me) AttachThreadInput(me, ft, false);
        return GetForegroundWindow() == h;
    }
    public static void Click(int x, int y) { SetCursorPos(x, y); mouse_event(0x0002, 0, 0, 0, IntPtr.Zero); mouse_event(0x0004, 0, 0, 0, IntPtr.Zero); }
    public static int Caps(int i) { IntPtr dc = GetDC(IntPtr.Zero); int v = GetDeviceCaps(dc, i); ReleaseDC(IntPtr.Zero, dc); return v; }
    // awareness: 0 = DPI-unaware (Windows phóng to bitmap), 1 = system aware, 2 = per-monitor aware
    public static string Dpi(IntPtr h) { try { return GetDpiForWindow(h) + " dpi, awareness " + GetAwarenessFromDpiAwarenessContext(GetWindowDpiAwarenessContext(h)); } catch (Exception e) { return "n/a (" + e.GetType().Name + ")"; } }
    public static string SelfAwareness() { try { return GetAwarenessFromDpiAwarenessContext(GetThreadDpiAwarenessContext()).ToString(); } catch (Exception e) { return "n/a (" + e.GetType().Name + ")"; } }
    public static string ConsoleFont(string face) {
        IntPtr h = GetStdHandle(-11); FONT i = new FONT(); i.cbSize = (uint)Marshal.SizeOf(i);
        if (!GetCurrentConsoleFontEx(h, false, ref i)) return "không đọc được";
        string old = i.Face;
        if ((i.Family & 4) != 0) return old;
        i.nFont = 0; i.X = 0; i.Y = (short)(i.Y < 14 ? 16 : i.Y); i.Family = 54; i.Weight = 400; i.Face = face;
        return old + (SetCurrentConsoleFontEx(h, false, ref i) ? " → " + face : " (không đổi được)");
    }
}
"@

$fontInfo = try { [VdDiag]::ConsoleFont('Consolas') } catch { "lỗi: $($_.Exception.Message)" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $env:TEMP "VietDA-chan-doan-$env:COMPUTERNAME-$stamp"
New-Item -ItemType Directory -Path $out | Out-Null
$report = Join-Path $out 'bao-cao.txt'
function Log([string]$Message) { Write-Host $Message; Add-Content -LiteralPath $report -Value $Message -Encoding UTF8 }
function Section([string]$Title) { Log ''; Log "===== $Title =====" }

# ---------- OCR ----------
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($Op, [Type]$T) { $task = $asTask.MakeGenericMethod($T).Invoke($null, @($Op)); [void]$task.Wait(-1); $task.Result }

function Invoke-Ocr($Bmp, $Engine) {
    $ms = New-Object IO.MemoryStream
    $Bmp.Save($ms, [Drawing.Imaging.ImageFormat]::Png)
    $ras = New-Object Windows.Storage.Streams.InMemoryRandomAccessStream
    $wr = New-Object Windows.Storage.Streams.DataWriter($ras.GetOutputStreamAt(0))
    $wr.WriteBytes($ms.ToArray())
    [void](Await ($wr.StoreAsync()) ([uint32]))
    $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $sb = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    Await ($Engine.RecognizeAsync($sb)) ([Windows.Media.Ocr.OcrResult])
}

# Chụp vùng (tọa độ của script) → ảnh phóng to $Zoom lần. $Phys = nhân tọa độ với hệ số Scale màn hình (cách tool mới), không thì chụp nguyên tọa độ (cách tool cũ)
function Get-Shot([int]$X, [int]$Y, [int]$W, [int]$H, [int]$Zoom, [bool]$Phys) {
    $s = if ($Phys) { $script:scale } else { 1.0 }
    $bmp = New-Object Drawing.Bitmap ([Math]::Max(1, [int][Math]::Round($W * $s))), ([Math]::Max(1, [int][Math]::Round($H * $s)))
    $g = [Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen([int][Math]::Round($X * $s), [int][Math]::Round($Y * $s), 0, 0, $bmp.Size); $g.Dispose()
    if ($Zoom -le 1 -and -not $Phys) { return $bmp }
    $big = New-Object Drawing.Bitmap ([Math]::Max(1, $W * $Zoom)), ([Math]::Max(1, $H * $Zoom))
    $g = [Drawing.Graphics]::FromImage($big); $g.InterpolationMode = 'HighQualityBicubic'; $g.DrawImage($bmp, 0, 0, $big.Width, $big.Height); $g.Dispose(); $bmp.Dispose()
    return $big
}

$menuRe = '(?i)^Th[uưúùủũụ]-?ch[iíìỉĩị]'
# OCR 1 vùng theo 2 cách chụp × các mức phóng × các engine → ghi báo cáo, trả về vị trí "Thu chi" (tọa độ script) nếu thấy
function Test-Region([string]$Name, [int]$X, [int]$Y, [int]$W, [int]$H, [int[]]$Zooms, [string]$Want) {
    $found = $null
    foreach ($phys in @($true, $false)) {
        $way = if ($phys) { 'moi' } else { 'cu' }
        foreach ($z in $Zooms) {
            $bmp = Get-Shot $X $Y $W $H $z $phys
            $file = "$Name-$way-x$z.png"
            $bmp.Save((Join-Path $out $file), [Drawing.Imaging.ImageFormat]::Png)
            foreach ($e in $script:engines) {
                try { $res = Invoke-Ocr $bmp $e.Engine } catch { Log "  [$file][$($e.Tag)] OCR lỗi: $($_.Exception.Message)"; continue }
                $lines = @(foreach ($l in $res.Lines) { $l.Text })
                $words = @(foreach ($l in $res.Lines) { foreach ($wd in $l.Words) { $wd } })
                $hit = $null
                if ($Want -eq 'menu') {
                    for ($i = 0; $i -lt $words.Count -and -not $hit; $i++) {
                        $two = if ($i -lt $words.Count - 1) { "$($words[$i].Text)$($words[$i + 1].Text)" } else { $words[$i].Text }
                        if ($words[$i].Text -match $menuRe -or $two -match $menuRe) { $hit = $words[$i] }
                    }
                } else {
                    $hit = @(foreach ($l in $res.Lines) { if ($l.Text -match $Want) { foreach ($wd in $l.Words) { $wd; break } } }) | Select-Object -First 1
                }
                $mark = if ($hit) { 'THẤY' } else { '----' }
                Log ("  [{0}] {1,-6} {2} | {3}" -f $file, $e.Tag, $mark, ($lines -join ' / '))
                # chỉ lấy tọa độ từ cách chụp 'moi' (cách 'cu' lệch khi Scale ≠ 100%)
                if ($hit -and -not $found -and $phys) {
                    $r = $hit.BoundingRect
                    $found = [pscustomobject]@{ X = [int]($X + ($r.X + $r.Width / 2) / $z); Y = [int]($Y + ($r.Y + $r.Height / 2) / $z); Way = $way; Zoom = $z; Engine = $e.Tag }
                }
            }
            $bmp.Dispose()
        }
    }
    return $found
}

try {
    # ---------- 1. Máy ----------
    Section 'Máy'
    Log "Thời điểm: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  Máy: $env:COMPUTERNAME"
    Log "Windows: $([Environment]::OSVersion.VersionString)  PowerShell: $($PSVersionTable.PSVersion)"
    $hz = [VdDiag]::Caps(8); $phz = [VdDiag]::Caps(118); $vt = [VdDiag]::Caps(10); $pvt = [VdDiag]::Caps(117)
    $script:scale = if ($hz -gt 0 -and $phz -gt 0) { [double]$phz / $hz } else { 1.0 }
    Log "Màn hình script thấy: ${hz}x${vt}  pixel thật: ${phz}x${pvt}  LOGPIXELSX: $([VdDiag]::Caps(88))  → Scale ~ $([Math]::Round($script:scale * 100))%"
    Log "DPI awareness của script: $([VdDiag]::SelfAwareness())"
    foreach ($sc in [System.Windows.Forms.Screen]::AllScreens) { Log "Màn hình $($sc.DeviceName): $($sc.Bounds)$(if ($sc.Primary) { ' (chính)' })" }
    Log "Font console: $fontInfo"

    # ---------- 2. OCR ----------
    Section 'Ngôn ngữ OCR'
    Log "Ngôn ngữ user: $((Get-WinUserLanguageList | ForEach-Object { $_.LanguageTag }) -join ', ')"
    $script:engines = New-Object System.Collections.Generic.List[object]
    $prof = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($prof) { $script:engines.Add([pscustomobject]@{ Tag = "user:$($prof.RecognizerLanguage.LanguageTag)"; Engine = $prof }) }
    Log "Engine tool dùng (theo ngôn ngữ user): $(if ($prof) { $prof.RecognizerLanguage.LanguageTag } else { 'KHÔNG TẠO ĐƯỢC' })"
    $avail = @(foreach ($l in [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages) { $l.LanguageTag })
    Log "Gói OCR đã cài: $($avail -join ', ')"
    foreach ($tag in $avail) {
        if ($prof -and $tag -eq $prof.RecognizerLanguage.LanguageTag) { continue }
        $e = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language $tag))
        if ($e) { $script:engines.Add([pscustomobject]@{ Tag = $tag; Engine = $e }) }
    }
    if ($script:engines.Count -eq 0) { throw 'Windows OCR không khả dụng (không có gói ngôn ngữ OCR nào)' }

    # ---------- 3. VietDA ----------
    Section 'Cửa sổ VietDA'
    $main = $null; $vpid = 0
    foreach ($p in Get-Process -Name Menu, Main -ErrorAction SilentlyContinue) {
        Log "Process $($p.ProcessName).exe pid $($p.Id)  $($p.Path)"
        foreach ($top in [VdDiag]::Tops([uint32]$p.Id)) {
            if (-not [VdDiag]::IsWindowVisible($top)) { continue }
            $r = [VdDiag]::Rect($top)
            $mdi = [bool]([VdDiag]::Descendants($top) | Where-Object { [VdDiag]::ClassOf($_) -like '*MDICLIENT*' })
            Log "  top 0x$($top.ToString('X')) [$([VdDiag]::ClassOf($top))] '$([VdDiag]::TextOf($top))' $($r[0]),$($r[1])-$($r[2]),$($r[3]) iconic=$([VdDiag]::IsIconic($top)) MDI=$mdi $([VdDiag]::Dpi($top))"
            if ($mdi -and -not $main -and [VdDiag]::ClassOf($top) -like '*Window.8*') { $main = $top; $vpid = $p.Id }
        }
    }
    if (-not $main) { throw 'Không thấy cửa sổ chính VietDA đã đăng nhập (Menu.exe có MDICLIENT) — mở VietDA, đăng nhập rồi chạy lại.' }
    Log "Đưa VietDA lên trước: $([VdDiag]::Activate($main))"
    Start-Sleep -Milliseconds 800
    $mr = [VdDiag]::Rect($main)
    Log "Cửa sổ chính: $($mr[0]),$($mr[1])-$($mr[2]),$($mr[3])"
    $bar = $null
    foreach ($h in [VdDiag]::Descendants($main)) {
        if ([VdDiag]::GetParent($h) -ne $main -or -not [VdDiag]::IsWindowVisible($h)) { continue }
        $r = [VdDiag]::Rect($h); $ht = $r[3] - $r[1]
        Log "  con 0x$($h.ToString('X')) [$([VdDiag]::ClassOf($h))] $($r[0]),$($r[1]) $($r[2] - $r[0])x$ht '$([VdDiag]::TextOf($h))'"
        if ($ht -ge 15 -and $ht -le 40 -and (-not $bar -or $r[1] -lt $bar.T)) { $bar = [pscustomobject]@{ L = $r[0]; T = $r[1]; W = $r[2] - $r[0]; H = $ht } }
    }
    Log "Thanh menu theo luật của tool: $(if ($bar) { "$($bar.L),$($bar.T) $($bar.W)x$($bar.H)" } else { 'KHÔNG THẤY' })"

    $win = Get-Shot $mr[0] $mr[1] ($mr[2] - $mr[0]) ($mr[3] - $mr[1]) 1 $true
    $win.Save((Join-Path $out 'vietda-cua-so.png'), [Drawing.Imaging.ImageFormat]::Png); $win.Dispose()

    # ---------- 4. OCR thanh menu ----------
    Section 'OCR thanh menu (moi = chụp theo Scale, cu = chụp như tool cũ)'
    $hit = $null
    if ($bar) { $hit = Test-Region 'menu-bar' $bar.L $bar.T ([Math]::Min($bar.W, 900)) $bar.H @(2, 3, 4) 'menu' }
    Section 'OCR dải trên cùng cửa sổ (phòng khi luật tìm thanh menu chọn sai)'
    $strip = Test-Region 'dai-tren' $mr[0] $mr[1] ([Math]::Min($mr[2] - $mr[0], 1200)) 120 @(2, 3) 'menu'
    if (-not $hit) { $hit = $strip }
    Log ''
    Log "KẾT LUẬN menu 'Thu chi': $(if ($hit) { "THẤY ở $($hit.X),$($hit.Y) (cách chụp $($hit.Way), x$($hit.Zoom), $($hit.Engine))" } else { 'KHÔNG THẤY bằng mọi cách' })"

    # ---------- 5. Bấm thử menu (tùy chọn) ----------
    if ($hit) {
        Write-Host ''
        $ans = Read-Host 'Bước 2 (tùy chọn): cho script BẤM menu "Thu chi" 1 lần để chụp menu xổ xuống rồi tự Esc? Gõ Y + Enter (Enter = bỏ qua)'
        if ($ans -match '^[yY]$') {
            Section 'Menu xổ xuống'
            [void][VdDiag]::Activate($main); Start-Sleep -Milliseconds 400
            $before = @{}; foreach ($t in [VdDiag]::Tops([uint32]$vpid)) { $before[$t.ToInt64()] = $true }
            [VdDiag]::Click($hit.X + 10, $hit.Y)
            Log "Đã bấm $($hit.X + 10),$($hit.Y)"
            $drop = $null; $wait = (Get-Date).AddSeconds(3)
            while (-not $drop -and (Get-Date) -lt $wait) {
                Start-Sleep -Milliseconds 200
                $drop = @([VdDiag]::Tops([uint32]$vpid) | Where-Object { -not $before.ContainsKey($_.ToInt64()) -and [VdDiag]::IsWindowVisible($_) -and [VdDiag]::ClassOf($_) -notlike '*Shadow*' }) | Select-Object -First 1
            }
            Start-Sleep -Milliseconds 300
            if ($drop) {
                $r = [VdDiag]::Rect($drop)
                Log "Menu xổ: 0x$($drop.ToString('X')) [$([VdDiag]::ClassOf($drop))] $($r[0]),$($r[1])-$($r[2]),$($r[3])"
                [void](Test-Region 'menu-xo-thu' $r[0] $r[1] ($r[2] - $r[0]) ($r[3] - $r[1]) @(3) '(?i)^Phi\S*\s+thu\s+.*\(b')
                [void](Test-Region 'menu-xo-chi' $r[0] $r[1] ($r[2] - $r[0]) ($r[3] - $r[1]) @(3) '(?i)^Phi\S*\s+chi\s+.*\(b')
            } else {
                Log 'KHÔNG thấy cửa sổ menu xổ xuống mới — chụp vùng dưới chỗ bấm'
                [void](Test-Region 'duoi-cho-bam' ($hit.X - 40) ($hit.Y + 8) 420 420 @(3) '(?i)^Phi\S*\s+(thu|chi)\s+.*\(b')
            }
            [System.Windows.Forms.SendKeys]::SendWait('{ESC}'); Start-Sleep -Milliseconds 200; [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        }
    }
} catch {
    Log "LỖI: $($_.Exception.Message)"
    Log $_.ScriptStackTrace
}

# log của tool (nếu cùng thư mục) — 150 dòng cuối
$toolLog = Join-Path $PSScriptRoot '_vietda-ck-import.log'
if (Test-Path -LiteralPath $toolLog) { Get-Content -LiteralPath $toolLog -Encoding UTF8 -Tail 150 | Set-Content -LiteralPath (Join-Path $out 'tool-log-cuoi.txt') -Encoding UTF8 }
foreach ($f in @('_vietda-menu.png', '_vietda-doi-tuong.csv')) {
    $src = Join-Path $PSScriptRoot $f
    if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination $out }
}

$zip = Join-Path ([Environment]::GetFolderPath('Desktop')) "VietDA-chan-doan-$env:COMPUTERNAME-$stamp.zip"
Compress-Archive -Path (Join-Path $out '*') -DestinationPath $zip -Force
Write-Host ''
Write-Host "XONG. Gửi file này cho người hỗ trợ: $zip" -ForegroundColor Green
Start-Process explorer.exe "/select,`"$zip`""
