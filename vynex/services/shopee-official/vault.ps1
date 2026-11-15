param([ValidateSet('protect','unprotect')][string]$Operation,[ValidateSet('pinterest','youtube')][string]$Provider)
$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Security
$inputValue=[Console]::In.ReadToEnd()
$entropy=[Text.Encoding]::UTF8.GetBytes("vynex.shopee-official.$Provider.v1")
if($Operation -eq 'protect'){
 $encrypted=[Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($inputValue),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 [Console]::Write([Convert]::ToBase64String($encrypted))
}else{
 $plain=[Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($inputValue.Trim()),$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 [Console]::Write([Text.Encoding]::UTF8.GetString($plain))
}
