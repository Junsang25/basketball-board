# public/favicon.svg 와 똑같은 도형을 PNG로 뽑는다 (PWA 설치 아이콘용).
# SVG가 원본이고 이 스크립트는 그 좌표(512 기준)를 그대로 옮겨 적은 것.
#   pwsh tools/make-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'public/icons'
New-Item -ItemType Directory -Force -Path $out | Out-Null

foreach ($size in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#e0701d'))

  # 좌표는 512 기준으로 쓰고 비율만 맞춘다
  $k = $size / 512
  $g.ScaleTransform($k, $k)

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 12
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'

  $g.DrawRectangle($pen, 128, 120, 256, 240)             # 코트 경계
  $g.DrawLine($pen, 143, 360, 143, 290)                  # 3점 라인 직선 구간
  $g.DrawArc($pen, 135, 212, 242, 242, 200.8, 138.4)     # 3점 아크
  $g.DrawLine($pen, 369, 290, 369, 360)
  $g.DrawLine($pen, 215, 360, 215, 263)                  # 제한구역
  $g.DrawLine($pen, 215, 263, 297, 263)
  $g.DrawLine($pen, 297, 263, 297, 360)
  $g.DrawEllipse($pen, 225, 232, 62, 62)                 # 자유투 서클
  $g.DrawArc($pen, 225, 89, 62, 62, 0, 180)              # 센터 서클 반쪽
  $pen.Dispose(); $g.Dispose()
  $path = Join-Path $out "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "wrote $path"
}
