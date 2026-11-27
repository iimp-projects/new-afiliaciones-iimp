param(
  [switch]$Activate,
  [switch]$EnableUpdates
)

# Configura Apple Wallet REAL en QA de forma segura.
# - Pide la passphrase QA por consola (SecureString), NO la imprime.
# - Valida que descifre la clave QA antes de subirla.
# - Guarda la passphrase como SecureString en SSM (/afiliaciones/qa/).
# - Regenera app.env con bootstrap-env.sh y reinicia SOLO el servicio app.
# - Con -Activate habilita CARD_APPLE_WALLET_ENABLED=true.
# - Con -EnableUpdates genera (si falta) el secreto HMAC y activa updates.
#
# Uso:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa\configure-apple-qa.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa\configure-apple-qa.ps1 -Activate
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\qa\configure-apple-qa.ps1 -Activate -EnableUpdates

$ErrorActionPreference = 'Stop'
$region = 'us-east-2'
$prefix = '/afiliaciones/qa/'
$instance = 'i-095d15242588ec268'
$qaKey = 'C:\iimp\secrets\apple-wallet\qa\iimp-membership-qa.key'
$oss = 'C:\Program Files\Git\usr\bin\openssl.exe'
$tmpDir = Join-Path $env:TEMP ('apple-qa-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmpDir | Out-Null

function Set-PrivateDir([string]$path) {
  $acl = New-Object System.Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($me, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $acl.AddAccessRule($rule)
  Set-Acl -Path $path -AclObject $acl
}
Set-PrivateDir $tmpDir

function Put-SecureParam([string]$name, [string]$value, [string]$type) {
  $obj = @{ Name = $prefix + $name; Value = $value; Type = $type; Overwrite = $true } | ConvertTo-Json -Compress
  $f = Join-Path $tmpDir ([guid]::NewGuid().ToString('N') + '.json')
  [System.IO.File]::WriteAllText($f, $obj, (New-Object System.Text.UTF8Encoding($false)))
  try {
    aws ssm put-parameter --region $region --cli-input-json ('file://' + $f.Replace('\', '/')) 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo escribir el parametro $name" }
    Write-Output ('SSM_OK ' + $name + ' type=' + $type)
  } finally {
    Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
  }
}

function Param-Exists([string]$name) {
  aws ssm get-parameter --region $region --name ($prefix + $name) --query 'Parameter.Name' --output text 2>$null | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Run-Remote([string[]]$commands) {
  $input = @{ InstanceIds = @($instance); DocumentName = 'AWS-RunShellScript'; Comment = 'configure apple qa (authorized)'; Parameters = @{ commands = $commands } } | ConvertTo-Json -Depth 6 -Compress
  $f = Join-Path $tmpDir ([guid]::NewGuid().ToString('N') + '-ssm.json')
  [System.IO.File]::WriteAllText($f, $input, (New-Object System.Text.UTF8Encoding($false)))
  try {
    $cmdId = aws ssm send-command --region $region --cli-input-json ('file://' + $f.Replace('\', '/')) --query 'Command.CommandId' --output text 2>&1
  } finally {
    Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
  }
  if (-not $cmdId) { throw 'No se pudo enviar el comando SSM' }
  for ($i = 0; $i -lt 60; $i++) {
    $status = aws ssm get-command-invocation --region $region --command-id $cmdId --instance-id $instance --query 'Status' --output text 2>&1
    if ($status -in @('Success', 'Failed', 'Cancelled', 'TimedOut')) {
      Write-Output ('REMOTE_STATUS=' + $status)
      if ($status -ne 'Success') {
        aws ssm get-command-invocation --region $region --command-id $cmdId --instance-id $instance --query 'StandardErrorContent' --output text 2>&1
        throw 'Comando remoto fallo'
      }
      return
    }
    Start-Sleep -Seconds 5
  }
  throw 'Timeout esperando el comando remoto'
}

$secure = Read-Host -Prompt 'Ingrese la passphrase QA de Apple Wallet' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

try {
  $env:IIMP_QA_KEY_PP = $plain
  & $oss pkey -in $qaKey -passin 'env:IIMP_QA_KEY_PP' -noout 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'La passphrase no descifra la clave QA (no se sube nada).' }
  Write-Output 'PASSPHRASE_VALID'

  Put-SecureParam 'APPLE_WALLET_PASS_KEY_PASSPHRASE' $plain 'SecureString'
  $plain = $null
  [GC]::Collect()

  if ($EnableUpdates) {
    if (-not (Param-Exists 'CARD_WALLET_PASS_AUTH_SECRET')) {
      $hmac = (& $oss rand -base64 48).Trim()
      if (-not $hmac) { throw 'No se pudo generar el secreto HMAC' }
      Put-SecureParam 'CARD_WALLET_PASS_AUTH_SECRET' $hmac 'SecureString'
      Put-SecureParam 'CARD_WALLET_PASS_AUTH_SECRET_VERSION' '1' 'String'
    }
    Put-SecureParam 'APPLE_WALLET_UPDATES_ENABLED' 'true' 'String'
    Write-Output 'SSM_UPDATES=true'
  }

  if ($Activate) {
    Put-SecureParam 'CARD_APPLE_WALLET_ENABLED' 'true' 'String'
    Write-Output 'SSM_APPLE_ENABLED=true'
  }

  Run-Remote @(
    '/opt/afiliaciones-qa/bootstrap-env.sh',
    'cd /opt/afiliaciones-qa && docker compose -f docker-compose.yml -f .qa-app-image.override.yml up -d app',
    'cd /opt/afiliaciones-qa; docker compose -f docker-compose.yml -f .qa-app-image.override.yml exec -T app sh -c ''printenv CARD_APPLE_WALLET_ENABLED APPLE_WALLET_UPDATES_ENABLED APPLE_WALLET_PASS_TYPE_ID; printenv | cut -d= -f1 | grep -q "^APPLE_WALLET_PASS_KEY_PASSPHRASE$" && echo PASSPHRASE_PRESENT || echo PASSPHRASE_MISSING'''
  )
  Write-Output 'APPLE_QA_CONFIG_APPLIED'
} finally {
  Remove-Item Env:IIMP_QA_KEY_PP -ErrorAction SilentlyContinue
  $plain = $null
  [GC]::Collect()
  Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
