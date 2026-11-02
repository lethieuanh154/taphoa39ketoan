<#
.SYNOPSIS
  Nạp lần lượt mọi file XML hóa đơn trong 1 thư mục vào phiếu đang mở trên VietDA
  (nút "Thêm từ file XML"), thay cho việc bấm + chọn file tay từng cái.

.DESCRIPTION
  Không dùng chuột/bàn phím, không giành focus: bấm nút qua MSAA (accDoDefaultAction),
  điền đường dẫn vào hộp thoại chọn file bằng WM_SETTEXT, đóng hộp thoại bằng WM_COMMAND.
  Người dùng vẫn làm việc khác bình thường; chỉ KHÔNG được thao tác trên VietDA khi tool đang chạy.

  - Tự bấm OK câu hỏi "Dữ liệu trong chứng từ đã có! ... hội nhập thêm từ file XML không?".
  - Gặp hộp thoại lạ (câu hỏi không biết trả lời) → DỪNG, để nguyên hộp thoại cho người dùng xử lý.
  - Chống nạp trùng: khóa = MST người bán | mẫu+ký hiệu | số HĐ. Bỏ qua file trùng trong lần chạy
    và file đã nạp ở lần chạy trước (sổ _vietda-da-nhap.txt trong thư mục), trừ khi -Force.
  - Tool KHÔNG bấm Lưu: kiểm tra phiếu rồi tự Lưu trên VietDA.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File vietda-xml-import.ps1 -Folder "D:\HoaDonXML\BanRa\2026-11" -DryRun
  powershell -ExecutionPolicy Bypass -File vietda-xml-import.ps1 -Folder "D:\HoaDonXML\BanRa\2026-11"
#>
param(
    [string]$Folder,
    [switch]$DryRun,
    [switch]$Force,
    [int]$TimeoutSec = 120
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

if (-not ('Vda' -as [type])) {
    Add-Type -ReferencedAssemblies Accessibility -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Accessibility;

public class VdaClick { public volatile bool Done; public string Error; }

public static class Vda {
    public const string XmlButtonText = "Th\u00eam t\u1eeb file XML";
    const uint WM_SETTEXT = 0x0C, WM_GETTEXT = 0x0D, WM_GETTEXTLENGTH = 0x0E, WM_COMMAND = 0x111, WM_NULL = 0;
    const uint SMTO_ABORTIFHUNG = 2;

    delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr p, EnumProc cb, IntPtr l);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern int GetDlgCtrlID(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr d, int id);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
    [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, IntPtr l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, StringBuilder l, uint f, uint t, out IntPtr r);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr h, uint m, IntPtr w, string l, uint f, uint t, out IntPtr r);
    [DllImport("oleacc.dll")] static extern int AccessibleObjectFromWindow(IntPtr h, uint id, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out object o);

    public static string ClassOf(IntPtr h) { StringBuilder sb = new StringBuilder(256); GetClassName(h, sb, 256); return sb.ToString(); }

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

    // WM_COMMAND (BN_CLICKED = 0 ở high word) gửi thẳng cho dialog: không cần dialog active như BM_CLICK
    public static void Press(IntPtr dlg, int id) { PostMessage(dlg, WM_COMMAND, (IntPtr)id, GetDlgItem(dlg, id)); }

    public static void MoveOffscreen(IntPtr h) { SetWindowPos(h, IntPtr.Zero, -32000, -32000, 0, 0, 0x0001 | 0x0004 | 0x0010); }

    public static IntPtr[] Descendants(IntPtr root) {
        List<IntPtr> list = new List<IntPtr>();
        EnumChildWindows(root, delegate(IntPtr h, IntPtr l) { list.Add(h); return true; }, IntPtr.Zero);
        return list.ToArray();
    }

    public static IntPtr[] Dialogs(int pid) {
        List<IntPtr> list = new List<IntPtr>();
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            uint p;
            GetWindowThreadProcessId(h, out p);
            if (p == (uint)pid && IsWindowVisible(h) && ClassOf(h) == "#32770") list.Add(h);
            return true;
        }, IntPtr.Zero);
        return list.ToArray();
    }

    public static IntPtr[] VisibleButtons(IntPtr root, string text) {
        List<IntPtr> list = new List<IntPtr>();
        foreach (IntPtr h in Descendants(root)) {
            if (ClassOf(h).ToUpperInvariant().Contains("BUTTON") && IsWindowVisible(h) && TextOf(h) == text) list.Add(h);
        }
        return list.ToArray();
    }

    // Ô tên file của hộp thoại Open: id 1148 (ComboBoxEx/ComboBox chứa Edit) hoặc Edit id 1152 (kiểu cũ)
    public static IntPtr FileNameEdit(IntPtr dlg) {
        IntPtr[] all = Descendants(dlg);
        foreach (IntPtr h in all) {
            if (GetDlgCtrlID(h) != 1148) continue;
            if (ClassOf(h) == "Edit") return h;
            foreach (IntPtr c in Descendants(h)) if (ClassOf(c) == "Edit") return c;
        }
        foreach (IntPtr h in all) if (GetDlgCtrlID(h) == 1152 && ClassOf(h) == "Edit") return h;
        return IntPtr.Zero;
    }

    // MessageBox: nội dung nằm ở Static id 0xFFFF; trả null nếu không phải MessageBox
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

    // accDoDefaultAction chạy đồng bộ tới khi handler nút trả về (gồm cả hộp thoại modal) → chạy ở thread nền
    public static VdaClick ClickAsync(IntPtr button) {
        VdaClick job = new VdaClick();
        Thread t = new Thread(delegate() {
            try {
                Guid iid = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
                object o;
                int hr = AccessibleObjectFromWindow(button, 0xFFFFFFFC, ref iid, out o);
                if (hr != 0) throw new Exception("AccessibleObjectFromWindow hr=0x" + hr.ToString("X8"));
                ((IAccessible)o).accDoDefaultAction(0);
            } catch (Exception e) {
                job.Error = e.Message;
            } finally {
                job.Done = true;
            }
        });
        t.IsBackground = true;
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        return job;
    }
}
"@
}

if (-not $Folder) {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Chọn thư mục chứa file XML hóa đơn'
    if ($picker.ShowDialog() -ne 'OK') { Write-Host 'Đã hủy.'; exit 1 }
    $Folder = $picker.SelectedPath
}
if (-not (Test-Path -LiteralPath $Folder -PathType Container)) { Write-Host "Không thấy thư mục: $Folder" -ForegroundColor Red; exit 1 }
$Folder = (Resolve-Path -LiteralPath $Folder).Path

$LogFile = Join-Path $Folder '_vietda-import.log'
$LedgerFile = Join-Path $Folder '_vietda-da-nhap.txt'

function Write-Log([string]$Level, [string]$Message) {
    $line = '{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $Level, $Message
    $color = @{ INFO = 'Gray'; OK = 'Green'; WARN = 'Yellow'; ERROR = 'Red' }[$Level]
    Write-Host $line -ForegroundColor $color
    Add-Content -LiteralPath $LogFile -Value $line -Encoding UTF8
}

function Get-InvoiceKey([string]$Path) {
    try {
        $xml = New-Object System.Xml.XmlDocument
        $xml.Load($Path)
        $pick = { param($xp) $n = $xml.SelectSingleNode($xp); if ($n) { $n.InnerText.Trim() } else { '' } }
        $so = & $pick "//*[local-name()='TTChung']/*[local-name()='SHDon']"
        if ($so) {
            $mau = & $pick "//*[local-name()='TTChung']/*[local-name()='KHMSHDon']"
            $ky = & $pick "//*[local-name()='TTChung']/*[local-name()='KHHDon']"
            $mst = & $pick "//*[local-name()='NBan']/*[local-name()='MST']"
            $soNum = 0L
            if ([long]::TryParse($so, [ref]$soNum)) { $so = "$soNum" }
            return "$mst|$mau$ky|$so"
        }
        Write-Log WARN "Không đọc được số HĐ trong $(Split-Path $Path -Leaf) → chống trùng theo hash file"
    } catch {
        Write-Log WARN "XML lỗi cú pháp $(Split-Path $Path -Leaf): $($_.Exception.Message) → chống trùng theo hash file"
    }
    return 'sha256:' + (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function New-Result([string]$Status, [string]$Message) { [pscustomobject]@{ Status = $Status; Message = $Message } }

# Một vòng "Thêm từ file XML": OK | CHECK (VietDA báo thông điệp, cần xem lại) | FATAL (dừng cả lượt)
function Invoke-XmlImport([string]$Path) {
    $job = [Vda]::ClickAsync($script:button)
    $submitted = $false
    $submittedAt = $null
    $notes = New-Object System.Collections.Generic.List[string]
    $firstSeen = @{}
    $pressedAt = @{}
    $deadline = (Get-Date).AddSeconds($TimeoutSec)

    while ($true) {
        $now = Get-Date
        if ($now -gt $deadline) { return New-Result FATAL "quá $TimeoutSec giây vẫn chưa nạp xong" }

        $dialogs = @([Vda]::Dialogs($script:vdaPid) | Where-Object {
            $k = $_.ToInt64()
            if (-not $firstSeen.ContainsKey($k)) { $firstSeen[$k] = $now }
            # chờ hộp thoại dựng xong control; bỏ qua hộp thoại vừa bấm đang đóng
            (($now - $firstSeen[$k]).TotalMilliseconds -ge 150) -and
            (-not $pressedAt.ContainsKey($k) -or ($now - $pressedAt[$k]).TotalSeconds -gt 3)
        })

        if ($dialogs.Count -eq 0) {
            if ($job.Done) {
                if ($job.Error) { return New-Result FATAL "không bấm được nút '$([Vda]::XmlButtonText)': $($job.Error)" }
                if (-not $submitted) { return New-Result FATAL 'VietDA không mở hộp thoại chọn file' }
                if ([Vda]::Dialogs($script:vdaPid).Count -eq 0 -and [Vda]::IsIdle($script:mainWindow)) {
                    if ($notes.Count) { return New-Result CHECK ($notes -join ' | ') }
                    return New-Result OK ''
                }
            }
            Start-Sleep -Milliseconds 100
            continue
        }

        $fileDialog = $null
        foreach ($d in $dialogs) {
            $k = $d.ToInt64()
            $edit = [Vda]::FileNameEdit($d)
            if ($edit -ne [IntPtr]::Zero) { $fileDialog = @{ Handle = $d; Edit = $edit }; continue }

            $text = [Vda]::MessageText($d)
            if ($null -eq $text) {
                if (($now - $firstSeen[$k]).TotalSeconds -gt 10) { return New-Result FATAL "hộp thoại không nhận dạng được: '$([Vda]::TextOf($d))' (để nguyên cho người dùng xử lý)" }
                continue
            }
            $title = [Vda]::TextOf($d)
            $hasOk = [Vda]::GetDlgItem($d, 1) -ne [IntPtr]::Zero
            $hasCancel = [Vda]::GetDlgItem($d, 2) -ne [IntPtr]::Zero

            if (-not $submitted) {
                if ($text -match 'XML' -and $hasOk -and $hasCancel) {
                    [Vda]::MoveOffscreen($d)
                    [Vda]::Press($d, 1)
                    $pressedAt[$k] = $now
                    continue
                }
                return New-Result FATAL "VietDA hỏi trước khi chọn file — [$title] $text (để nguyên cho người dùng xử lý)"
            }
            if ([Vda]::ButtonCount($d) -le 1) {
                $notes.Add("[$title] $text")
                [Vda]::Press($d, $(if ($hasOk) { 1 } else { 2 }))
                $pressedAt[$k] = $now
                continue
            }
            return New-Result FATAL "VietDA hỏi sau khi nạp file — [$title] $text (để nguyên cho người dùng xử lý)"
        }

        if ($fileDialog) {
            $d = $fileDialog.Handle
            if (-not $submitted) {
                [Vda]::MoveOffscreen($d)
                [void][Vda]::SetText($fileDialog.Edit, $Path)
                $typed = [Vda]::TextOf($fileDialog.Edit)
                if ($typed -ne $Path) {
                    [Vda]::Press($d, 2)
                    return New-Result FATAL "không điền được đường dẫn vào hộp thoại chọn file (đọc lại: '$typed')"
                }
                [Vda]::Press($d, 1)
                $pressedAt[$d.ToInt64()] = $now
                $submitted = $true
                $submittedAt = $now
            } elseif (($now - $submittedAt).TotalSeconds -gt 10) {
                $notes.Add('hộp thoại chọn file không đóng sau khi chọn → đã Cancel')
                [Vda]::Press($d, 2)
                $pressedAt[$d.ToInt64()] = $now
            }
        }
        Start-Sleep -Milliseconds 100
    }
}

Write-Log INFO "===== Bắt đầu$(if ($DryRun) { ' (DRY RUN)' }) — thư mục: $Folder"

$proc = Get-Process -Name Menu, Main -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1
if (-not $proc) { Write-Log ERROR 'Không thấy VietDA đang chạy (Menu.exe/Main.exe).'; exit 1 }
$script:vdaPid = $proc.Id
$script:mainWindow = $proc.MainWindowHandle

$openDialogs = @([Vda]::Dialogs($script:vdaPid))
if ($openDialogs.Count) {
    $d = $openDialogs[0]
    Write-Log ERROR "VietDA đang mở hộp thoại '$([Vda]::TextOf($d))' $([Vda]::MessageText($d)) — đóng nó rồi chạy lại."
    exit 1
}

$buttons = @([Vda]::VisibleButtons($script:mainWindow, [Vda]::XmlButtonText))
if ($buttons.Count -eq 0) { Write-Log ERROR "Không thấy nút '$([Vda]::XmlButtonText)' — mở phiếu cần nạp (vd Thu chi > Phiếu thu tiền mặt) rồi chạy lại."; exit 1 }
if ($buttons.Count -gt 1) { Write-Log ERROR "Thấy $($buttons.Count) nút '$([Vda]::XmlButtonText)' đang hiện — chỉ để 1 phiếu ở tab đang chọn rồi chạy lại."; exit 1 }
$script:button = $buttons[0]
$form = [Vda]::GetParent($script:button)
$target = "$([Vda]::TextOf($form)) [$([Vda]::TextOf([Vda]::GetParent($form)))]"
Write-Log INFO "Phiếu đích: $target"

$imported = @{}
if ((Test-Path -LiteralPath $LedgerFile) -and -not $Force) {
    foreach ($line in Get-Content -LiteralPath $LedgerFile -Encoding UTF8) {
        $parts = $line -split "`t"
        if ($parts[0]) { $imported[$parts[0]] = $parts[1] }
    }
}

$files = @(Get-ChildItem -LiteralPath $Folder -Filter *.xml -File | Where-Object { $_.Extension -eq '.xml' } | Sort-Object Name)
$queue = New-Object System.Collections.Generic.List[object]
$seen = @{}
$skippedLedger = 0
foreach ($f in $files) {
    $key = Get-InvoiceKey $f.FullName
    if ($imported.ContainsKey($key)) { $skippedLedger++; continue }
    if ($seen.ContainsKey($key)) { Write-Log WARN "Bỏ qua $($f.Name): trùng HĐ với $($seen[$key]) ($key)"; continue }
    $seen[$key] = $f.Name
    $queue.Add([pscustomobject]@{ Path = $f.FullName; Name = $f.Name; Key = $key })
}
if ($skippedLedger) { Write-Log INFO "Bỏ qua $skippedLedger file đã nạp ở lần chạy trước (xem $(Split-Path $LedgerFile -Leaf); dùng -Force để nạp lại)" }
Write-Log INFO "Có $($files.Count) file XML, sẽ nạp $($queue.Count) file."

if ($DryRun) {
    $i = 0
    foreach ($q in $queue) { $i++; Write-Log INFO "  [$i] $($q.Name)  ($($q.Key))" }
    Write-Log INFO '===== DRY RUN xong, chưa bấm gì trên VietDA.'
    exit 0
}

$ok = 0
$check = New-Object System.Collections.Generic.List[string]
$i = 0
foreach ($q in $queue) {
    $i++
    try {
        $result = Invoke-XmlImport $q.Path
    } catch {
        $result = New-Result FATAL "lỗi tool: $($_.Exception.Message)"
    }
    switch ($result.Status) {
        'OK' {
            $ok++
            Add-Content -LiteralPath $LedgerFile -Value ("{0}`t{1}`t{2:yyyy-MM-dd HH:mm:ss}`t{3}" -f $q.Key, $q.Name, (Get-Date), $target) -Encoding UTF8
            Write-Log OK "[$i/$($queue.Count)] $($q.Name)"
        }
        'CHECK' {
            $check.Add("$($q.Name): $($result.Message)")
            Write-Log WARN "[$i/$($queue.Count)] $($q.Name) — VietDA báo: $($result.Message) (chưa ghi sổ đã nạp, kiểm tra phiếu)"
        }
        default {
            Write-Log ERROR "[$i/$($queue.Count)] $($q.Name) — DỪNG: $($result.Message)"
        }
    }
    if ($result.Status -eq 'FATAL') { break }
}

Write-Log INFO "===== Kết thúc: nạp OK $ok/$($queue.Count) file$(if ($check.Count) { ", $($check.Count) file cần kiểm tra" })."
foreach ($c in $check) { Write-Log WARN "  Kiểm tra: $c" }
Write-Log INFO 'Tool KHÔNG bấm Lưu — kiểm tra tổng tiền trên phiếu rồi bấm Lưu trên VietDA.'
if ($ok + $check.Count -lt $queue.Count) { exit 2 }
exit 0
