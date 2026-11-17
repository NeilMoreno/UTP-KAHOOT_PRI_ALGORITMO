$ErrorActionPreference = 'Stop'

$securePassword = Read-Host 'Nueva contraseña del superadministrador admin@codeintcorp.com' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:ALLOW_SUPERADMIN_BOOTSTRAP = '1'
    $env:BOOTSTRAP_SUPERADMIN_PASSWORD = $plainPassword

    node scripts/bootstrap-superadmin.js
    if ($LASTEXITCODE -ne 0) {
        throw 'El bootstrap del superadministrador no terminó correctamente.'
    }
} finally {
    Remove-Item Env:ALLOW_SUPERADMIN_BOOTSTRAP -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_SUPERADMIN_PASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}
