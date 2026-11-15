param(
    [ValidateSet('voices', 'synthesize')][string]$Operation = 'voices',
    [string]$InputFile,
    [string]$OutputDirectory,
    [string]$Voice = 'Microsoft Maria Desktop',
    [ValidateRange(-5, 5)][int]$Rate = 0
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voiceInfo = @($synth.GetInstalledVoices() | ForEach-Object {
        @{ name = $_.VoiceInfo.Name; culture = $_.VoiceInfo.Culture.Name; enabled = $_.Enabled }
    })
    if ($Operation -eq 'voices') {
        ConvertTo-Json -InputObject $voiceInfo -Compress
        exit 0
    }
    $chosen = $voiceInfo | Where-Object { $_.name -eq $Voice -and $_.culture -eq 'pt-BR' -and $_.enabled }
    if (-not $chosen) { throw 'Selecione uma voz pt-BR instalada e habilitada no Windows.' }
    $synth.SelectVoice($Voice)
    $synth.Rate = $Rate
    $synth.Volume = 100
    $parts = [System.IO.File]::ReadAllText($InputFile, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
    if (-not $parts -or $parts.Count -gt 80) { throw 'Quantidade de trechos inválida.' }
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $index = 0
    foreach ($part in $parts) {
        $fileName = 'speech-{0:D3}.wav' -f $index
        $output = Join-Path $OutputDirectory $fileName
        $synth.SetOutputToWaveFile($output)
        $synth.Speak([string]$part)
        $synth.SetOutputToNull()
        $index++
    }
    ConvertTo-Json -InputObject @{ provider = 'windows-sapi'; voice = $Voice; culture = 'pt-BR'; rate = $Rate; segments = $index } -Compress
} finally { $synth.Dispose() }
