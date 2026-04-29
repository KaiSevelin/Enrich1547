Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead('foundry.zip')
$patterns=@('Topkapi','Topkapı','Eskişehir','Eskisehir','Fürstenfeld','Furstenfeld','Ottoman','Imperial Administration')
foreach($entry in $zip.Entries) {
    if($entry.Length -gt 0) {
        $stream = $entry.Open()
        $bytes = New-Object byte[] $entry.Length
        $stream.Read($bytes, 0, $entry.Length) | Out-Null
        $text = [System.Text.Encoding]::UTF8.GetString($bytes)
        foreach($pat in $patterns) {
            if($text -match [regex]::Escape($pat)) {
                Write-Output "$($entry.FullName): $pat"
                break
            }
        }
        $stream.Dispose()
    }
}
$zip.Dispose()
