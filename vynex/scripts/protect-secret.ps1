param([ValidateSet('protect','unprotect')][string]$Operation,[ValidateSet('youtube','youtube-client','azure-speech','buffer','shopee-affiliate')][string]$Purpose='youtube')
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$inputText = [Console]::In.ReadToEnd()
$entropy = [System.Text.Encoding]::UTF8.GetBytes("vynex.$Purpose.v1")
if ($Operation -eq 'protect') {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($inputText)
    $encrypted = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Write([Convert]::ToBase64String($encrypted))
} else {
    $bytes = [Convert]::FromBase64String($inputText.Trim())
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Write([System.Text.Encoding]::UTF8.GetString($plain))
}
