param(
  [string]$InputDir = "test-GAME-2D/obstacle-types/Sprite",
  [string]$OutputDir = "test-GAME-2D/obstacle-types/Sprite/colorized",
  [switch]$InPlace,
  [string]$CanopyLight = "#6fbf5f",
  [string]$CanopyDark = "#2f6b2f",
  [string]$TrunkLight = "#8b5a2b",
  [string]$TrunkDark = "#5b3a1e",
  [double]$LineThreshold = 0.30,
  [double]$BlendStrength = 1.0
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $InputDir)) {
  throw "InputDir introuvable: $InputDir"
}

Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;

public static class SpriteColorizer {
  public struct Rgb {
    public byte R;
    public byte G;
    public byte B;
  }

  public static Rgb ParseHex(string hex) {
    string h = hex.TrimStart('#');
    if (h.Length == 3) {
      h = "" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    if (h.Length != 6) throw new ArgumentException("Couleur invalide: " + hex);
    byte r = Convert.ToByte(h.Substring(0, 2), 16);
    byte g = Convert.ToByte(h.Substring(2, 2), 16);
    byte b = Convert.ToByte(h.Substring(4, 2), 16);
    return new Rgb { R = r, G = g, B = b };
  }

  static double Hash01(int x, int y) {
    int n = (x * 73856093) ^ (y * 19349663);
    n = n & 0x7fffffff;
    return (n % 10000) / 10000.0;
  }

  static byte LerpByte(byte a, byte b, double t) {
    return (byte)Math.Round(a + (b - a) * t);
  }

  static Rgb LerpColor(Rgb a, Rgb b, double t) {
    return new Rgb {
      R = LerpByte(a.R, b.R, t),
      G = LerpByte(a.G, b.G, t),
      B = LerpByte(a.B, b.B, t)
    };
  }

  public static void Colorize(string inputPath, string outputPath, string kind, string canopyLightHex, string canopyDarkHex, string trunkLightHex, string trunkDarkHex, double lineThreshold, double blendStrength) {
    var canopyLight = ParseHex(canopyLightHex);
    var canopyDark = ParseHex(canopyDarkHex);
    var trunkLight = ParseHex(trunkLightHex);
    var trunkDark = ParseHex(trunkDarkHex);

    using (var bmp = new Bitmap(inputPath)) {
      var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
      var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
      int stride = data.Stride;
      int total = stride * bmp.Height;
      byte[] bytes = new byte[total];
      System.Runtime.InteropServices.Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);

      double cx = (bmp.Width - 1) / 2.0;
      double cy = (bmp.Height - 1) / 2.0;
      double invW = bmp.Width > 1 ? 1.0 / bmp.Width : 1.0;
      double invH = bmp.Height > 1 ? 1.0 / bmp.Height : 1.0;

      for (int y = 0; y < bmp.Height; y++) {
        for (int x = 0; x < bmp.Width; x++) {
          int i = (y * stride) + (x * 4);
          byte b = bytes[i + 0];
          byte g = bytes[i + 1];
          byte r = bytes[i + 2];
          byte a = bytes[i + 3];
          if (a == 0) continue;

          double brightness = (r + g + b) / 765.0;
          if (brightness <= lineThreshold) continue;

          double blend = Math.Max(0.0, Math.Min(1.0, (brightness - lineThreshold) / (1.0 - lineThreshold)));
          blend = blend * blendStrength;
          if (blend <= 0.0) continue;

          double noise = Hash01(x, y);
          Rgb target;
          if (kind == "canopy") {
            double dx = (x - cx) * invW;
            double dy = (y - cy) * invH;
            double dist = Math.Sqrt((dx * dx) + (dy * dy));
            double t = Math.Max(0.0, Math.Min(1.0, 1.0 - (dist * 1.6)));
            t = Math.Max(0.0, Math.Min(1.0, t + (noise - 0.5) * 0.25));
            target = LerpColor(canopyDark, canopyLight, t);
          } else {
            double t = 1.0 - (y * invH);
            t = Math.Max(0.0, Math.Min(1.0, t + (noise - 0.5) * 0.15));
            target = LerpColor(trunkDark, trunkLight, t);
          }

          bytes[i + 0] = LerpByte(b, target.B, blend);
          bytes[i + 1] = LerpByte(g, target.G, blend);
          bytes[i + 2] = LerpByte(r, target.R, blend);
        }
      }

      System.Runtime.InteropServices.Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
      bmp.UnlockBits(data);
      bmp.Save(outputPath, ImageFormat.Png);
    }
  }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$resolvedOutput = if ($InPlace) { $InputDir } else { $OutputDir }
if (-not (Test-Path $resolvedOutput)) {
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}

$pngs = Get-ChildItem -Path $InputDir -Filter *.png -File
if (-not $pngs) {
  Write-Host "Aucun PNG trouve dans $InputDir"
  exit 0
}

foreach ($file in $pngs) {
  $name = $file.Name.ToLowerInvariant()
  $kind = if ($name -like "*canopy*.png") { "canopy" } elseif ($name -like "*trunk*.png") { "trunk" } else { "" }
  if (-not $kind) { continue }

  $srcPath = $file.FullName
  $destPath = if ($InPlace) { $srcPath } else { Join-Path $resolvedOutput $file.Name }

  [SpriteColorizer]::Colorize(
    $srcPath,
    $destPath,
    $kind,
    $CanopyLight,
    $CanopyDark,
    $TrunkLight,
    $TrunkDark,
    $LineThreshold,
    $BlendStrength
  )
}

Write-Host "Colorisation terminee -> $resolvedOutput"
