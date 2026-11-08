# Publica (ou atualiza) o Maxx no servidor da nuvem.
# Uso, no PowerShell, dentro da pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1 -IP 123.45.67.89 -Chave "C:\Users\voce\Downloads\ssh-key.key"
# Rode de novo sempre que mudar o codigo: os dados do servidor sao mantidos.
param(
  [Parameter(Mandatory = $true)][string]$IP,
  [Parameter(Mandatory = $true)][string]$Chave,
  [string]$Usuario = 'ubuntu'
)
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Chave)) { Write-Host "Nao achei a chave: $Chave" -ForegroundColor Red; exit 1 }
$Chave = (Resolve-Path $Chave).Path
$Projeto = Split-Path $PSScriptRoot -Parent

# O ssh do Windows recusa chaves que outros usuarios do PC conseguem ler.
icacls $Chave /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null

Write-Host '==> Empacotando o codigo (sem node_modules e sem a pasta dados)'
$Pacote = Join-Path $env:TEMP 'maxx.tgz'
if (Test-Path $Pacote) { Remove-Item $Pacote -Force }
tar -czf $Pacote -C $Projeto --exclude=node_modules --exclude=dados --exclude=.git .
if ($LASTEXITCODE -ne 0) { Write-Host 'Falha ao empacotar.' -ForegroundColor Red; exit 1 }

$Destino = "$Usuario@$IP"
$Opcoes = @('-i', $Chave, '-o', 'StrictHostKeyChecking=accept-new')

Write-Host "==> Enviando para $IP"
scp @Opcoes $Pacote "$($Destino):/tmp/maxx.tgz"
if ($LASTEXITCODE -ne 0) { Write-Host 'Falha ao enviar. Confira o IP e a chave.' -ForegroundColor Red; exit 1 }
scp @Opcoes (Join-Path $PSScriptRoot 'servidor.sh') "$($Destino):/tmp/maxx-servidor.sh"
if ($LASTEXITCODE -ne 0) { Write-Host 'Falha ao enviar.' -ForegroundColor Red; exit 1 }
Remove-Item $Pacote -Force

Write-Host '==> Instalando no servidor'
ssh -t @Opcoes $Destino "sed -i 's/\r$//' /tmp/maxx-servidor.sh && sudo bash /tmp/maxx-servidor.sh"
if ($LASTEXITCODE -ne 0) { Write-Host 'A instalacao falhou. Copie as mensagens acima e me mostre.' -ForegroundColor Red; exit 1 }
