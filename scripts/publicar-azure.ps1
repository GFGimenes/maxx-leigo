# Atualiza o Maxx no Azure App Service (site maxx-guilherme.azurewebsites.net).
# Uso, no PowerShell, dentro da pasta do projeto:
#   powershell -ExecutionPolicy Bypass -File scripts\publicar-azure.ps1
# Precisa do Azure CLI instalado e de login feito (az login --use-device-code).
# As contas, posts e fotos ficam no Azure em /home/maxx-dados e nao sao apagados.
param(
  [string]$Grupo = 'maxx-rg',
  [string]$Site = 'maxx-guilherme'
)
$ErrorActionPreference = 'Stop'
$az = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
if (-not (Test-Path $az)) { Write-Host 'Azure CLI nao encontrado.' -ForegroundColor Red; exit 1 }
$Projeto = Split-Path $PSScriptRoot -Parent

Write-Host '==> Empacotando o codigo'
$Zip = Join-Path $env:TEMP 'maxx-deploy.zip'
if (Test-Path $Zip) { Remove-Item $Zip -Force }
tar -a -c -f $Zip -C $Projeto package.json package-lock.json src public scripts README.md
if ($LASTEXITCODE -ne 0) { Write-Host 'Falha ao empacotar.' -ForegroundColor Red; exit 1 }

Write-Host '==> Enviando para o Azure (leva alguns minutos)'
& $az webapp deploy -g $Grupo -n $Site --src-path $Zip --type zip --only-show-errors -o none
if ($LASTEXITCODE -ne 0) { Write-Host 'Falha ao publicar. Se pedir login, rode: az login --use-device-code' -ForegroundColor Red; exit 1 }
Remove-Item $Zip -Force
Write-Host "Pronto: https://$Site.azurewebsites.net" -ForegroundColor Green
