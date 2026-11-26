# Credenciales Apple Wallet QA — guia de creacion (NO ejecutar automaticamente)

Objetivo: crear un Pass Type ID y material de firma **independientes de LOCAL**
para QA.

- Description: `IIMP Digital Membership QA`
- Pass Type ID: `pass.pe.org.iimp.membership.qa`
- Certificate Name: `IIMP Apple Wallet Membership QA`
- Team ID: `3U46BQMK52`
- Organizacion: `INST. DE INGENIEROS DE MINAS DEL PERU` (C=PE)
- Carpeta separada: `C:\iimp\secrets\apple-wallet\qa` (fuera del repo)
- No reutilizar la clave/certificado de LOCAL.

## 0) Crear el Pass Type ID en Apple Developer
1. Developer portal > Certificates, Identifiers & Profiles > Identifiers > Pass Type IDs.
2. Registrar `pass.pe.org.iimp.membership.qa` (Description `IIMP Digital Membership QA`).
3. Crear el certificado del Pass Type ID y descargar `pass.cer` (DER).

## 1) Carpeta y clave privada RSA cifrada (PowerShell)
```powershell
$qa = 'C:\iimp\secrets\apple-wallet\qa'
New-Item -ItemType Directory -Force -Path $qa | Out-Null
$oss = 'C:\Program Files\Git\usr\bin\openssl.exe'

# Pide la passphrase de forma interactiva; NO se escribe en el comando ni en el historial.
& $oss genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -aes-256-cbc `
  -out "$qa\iimp-membership-qa.key"

# Verificar que la clave es RSA 2048 y esta cifrada (pedira passphrase)
& $oss pkey -in "$qa\iimp-membership-qa.key" -noout -text | Select-String 'Private-Key'
```

## 2) CSR (firma valida)
```powershell
& $oss req -new -sha256 `
  -key "$qa\iimp-membership-qa.key" `
  -out "$qa\iimp-membership-qa.certSigningRequest" `
  -subj "/CN=Pass Type ID: pass.pe.org.iimp.membership.qa/OU=3U46BQMK52/O=INST. DE INGENIEROS DE MINAS DEL PERU/C=PE"

# Validar firma del CSR
& $oss req -in "$qa\iimp-membership-qa.certSigningRequest" -noout -verify -subject
```
Subir el CSR al portal y descargar el certificado emitido (`pass.cer`).

## 3) Convertir certificado a PEM y validar identidades
```powershell
& $oss x509 -inform DER -in "$qa\pass.cer" -out "$qa\iimp-membership-qa.pem"
& $oss x509 -in "$qa\iimp-membership-qa.pem" -noout -subject -issuer -dates

# Correspondencia clave <-> certificado (comparar SHA-256 de la clave publica)
$keyHash = (& $oss pkey -in "$qa\iimp-membership-qa.key" -pubout | & $oss sha256) -join ''
$certHash = (& $oss x509 -in "$qa\iimp-membership-qa.pem" -pubkey -noout | & $oss sha256) -join ''
if ($keyHash -eq $certHash) { 'KEY_MATCH_OK' } else { 'KEY_MATCH_FAIL' }
```
Verificar en el certificado: `UID=pass.pe.org.iimp.membership.qa`, `OU=3U46BQMK52`.

## 4) Cadena completa (reutiliza WWDR G4 y Apple Root CA publicos)
```powershell
& $oss verify -CAfile 'C:\iimp\secrets\apple-wallet\AppleIncRootCertificate.pem' `
  -untrusted 'C:\iimp\secrets\apple-wallet\AppleWWDRCAG4.pem' `
  "$qa\iimp-membership-qa.pem"
```
Debe responder `OK`.

## Reglas
- No versionar `.key`, `.pem`, `.cer`, `.p12` ni la passphrase.
- Passphrase: solo manual; nunca en chat, Git, logs, Terraform ni Docker.
- No reutilizar credenciales LOCAL en QA.
