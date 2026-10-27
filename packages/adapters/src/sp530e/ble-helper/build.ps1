$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$out = "$PSScriptRoot\Sp530eBleHelper.exe"
$src = "$PSScriptRoot\Sp530eBleHelper.cs"

$refs = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\mscorlib.dll",
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.dll",
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Core.dll",
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\System.Web.Extensions.dll",
    "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Runtime\v4.0_4.0.0.0__b03f5f7f11d50a3a\System.Runtime.dll",
    "C:\Windows\Microsoft.NET\assembly\GAC_MSIL\System.Runtime.InteropServices.WindowsRuntime\v4.0_4.0.0.0__b03f5f7f11d50a3a\System.Runtime.InteropServices.WindowsRuntime.dll",
    "C:\Windows\System32\WinMetadata\Windows.Foundation.winmd",
    "C:\Windows\System32\WinMetadata\Windows.Devices.winmd",
    "C:\Windows\System32\WinMetadata\Windows.Storage.winmd"
)

$refArgs = $refs | ForEach-Object { "/r:`"$_`"" }

& $csc /noconfig $refArgs /target:exe /out:"$out" "$src"
if ($LASTEXITCODE -eq 0) {
    Write-Host "Successfully compiled Sp530eBleHelper.exe"
} else {
    Write-Error "Compilation failed with code $LASTEXITCODE"
}
