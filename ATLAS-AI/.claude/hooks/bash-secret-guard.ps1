# Bloquea comandos Bash que escriban o exfiltren archivos de secretos/credenciales.
# Cierra el hueco de `echo $KEY > .env` que Write/Edit no cubre.
# Recibe el JSON del hook por stdin. Exit 2 = bloquea la acción.
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }
$cmd = [string]$data.tool_input.command
if (-not $cmd) { exit 0 }

$secret = '(\.env|[\\/]secrets[\\/]|credential|mt5.*(key|secret|login|cred)|exchange.*(key|secret|cred)|id_rsa|\.pem)'
$verb   = '(>>?|\btee\b|\bcp\b|\bmv\b|\bcat\b|Set-Content|Out-File|Add-Content)'
if ($cmd -match "(?i)$verb.*$secret") {
  [Console]::Error.WriteLine("BLOQUEADO: comando Bash intenta escribir/leer archivos de secretos.")
  exit 2
}
exit 0
