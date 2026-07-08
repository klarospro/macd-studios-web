# Bloquea escritura (Write/Edit) en archivos de secretos/credenciales.
# Recibe el JSON del hook por stdin. Exit 2 = bloquea la acción.
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }
$path = [string]$data.tool_input.file_path
if (-not $path) { exit 0 }

$pattern = '(?i)(\.env)|([\\/]secrets[\\/])|credential|(mt5.*(key|secret|login|cred))|(exchange.*(key|secret|cred))|(api[_-]?key)|(\.pem$)|(id_rsa)'
if ($path -match $pattern) {
  [Console]::Error.WriteLine("BLOQUEADO: no se permite escribir en archivos de credenciales/secretos ($path).")
  exit 2
}
exit 0
