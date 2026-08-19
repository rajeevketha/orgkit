#!/usr/bin/env python3
"""Capture CWS screenshots and build dark OrgFlow promo tiles for OrgKit 1.12.1."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "extension" / "store" / "submission" / "screenshots"
PROMO = ROOT / "extension" / "store" / "submission" / "promo"
ICON = ROOT / "extension" / "icons" / "orgkit-128.png"
ICON256 = ROOT / "extension" / "icons" / "orgkit-256.png"
ARCHIVE = SHOTS / "archive-do-not-upload"

BG = (13, 17, 23, 255)
CARD = (22, 27, 34, 255)
BORDER = (48, 54, 61, 255)
TEXT = (230, 237, 243, 255)
MUTED = (139, 148, 158, 255)
ACCENT = (88, 166, 255, 255)
INK = (240, 246, 252, 255)

INTER = Path("/usr/share/fonts/truetype/macos/Inter-Regular.ttf")
INTER_MED = Path("/usr/share/fonts/truetype/macos/Inter-Medium.ttf")
INTER_SEMI = Path("/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf")
INTER_BOLD = Path("/usr/share/fonts/truetype/macos/Inter-Bold.ttf")

CAPTURES = {
    "home-1280x800.png": "capture-home.html",
    "query-1280x800.png": "capture-query.html",
    "schema-1280x800.png": "capture-schema.html",
    "compare-1280x800.png": "capture-compare.html",
    "launcher-1280x800.png": "capture-launcher.html",
}

ARCHIVE_NAMES = [
    "01-home-1280x800.png",
    "01-home-640x400.png",
    "02-nl-soql-1280x800.png",
    "02-nl-soql-640x400.png",
    "03-soql-runner-1280x800.png",
    "03-soql-runner-640x400.png",
    "04-describe-1280x800.png",
    "04-describe-640x400.png",
    "05-error-states-1280x800.png",
    "05-error-states-640x400.png",
    "06-onpage-launcher-1280x800.png",
    "06-onpage-launcher-640x400.png",
    "illustrated-home-1280x800.png",
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def capture(html_name: str, out_path: Path) -> None:
    html = SHOTS / html_name
    chrome = shutil.which("google-chrome") or shutil.which("chromium")
    if not chrome:
        raise SystemExit("google-chrome not found")
    with tempfile.TemporaryDirectory() as td:
        raw = Path(td) / "raw.png"
        ud = Path(td) / "ud"
        ud.mkdir()
        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--user-data-dir={ud}",
            "--force-device-scale-factor=1",
            "--window-size=1280,800",
            "--virtual-time-budget=3000",
            f"--screenshot={raw}",
            html.as_uri(),
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(40):
                if raw.exists() and raw.stat().st_size > 1000:
                    time.sleep(0.4)
                    break
                if proc.poll() is not None:
                    break
                time.sleep(0.25)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=5)
        if not raw.exists() or raw.stat().st_size < 1000:
            raise SystemExit(f"screenshot missing for {html_name}")
        im = Image.open(raw).convert("RGBA")
        if im.size != (1280, 800):
            im = im.crop((0, 0, min(1280, im.width), min(800, im.height)))
            canvas = Image.new("RGBA", (1280, 800), BG)
            canvas.paste(im, (0, 0))
            im = canvas
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.convert("RGB").save(out_path, "PNG", optimize=True)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: int, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paste_icon(canvas: Image.Image, xy: tuple[int, int], size: int) -> None:
    src = ICON256 if ICON256.exists() else ICON
    icon = Image.open(src).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, xy)


def make_small_promo() -> Image.Image:
    im = Image.new("RGBA", (440, 280), BG)
    d = ImageDraw.Draw(im)
    rounded_rect(d, (16, 16, 424, 264), 18, CARD, BORDER, 1)
    paste_icon(im, (36, 44), 72)
    d.text((124, 52), "OrgKit", font=font(INTER_BOLD, 34), fill=INK)
    d.text((124, 96), "Query · Schema · Compare · Apex", font=font(INTER_MED, 14), fill=ACCENT)
    d.text(
        (36, 148),
        "Four Salesforce tools in the org\nalready open in Chrome.\nTab session only — never stores sid.",
        font=font(INTER, 15),
        fill=MUTED,
        spacing=5,
    )
    return im.convert("RGB")


def make_marquee(home: Path) -> Image.Image:
    im = Image.new("RGBA", (1400, 560), BG)
    d = ImageDraw.Draw(im)
    # left copy
    paste_icon(im, (72, 118), 128)
    d.text((220, 128), "OrgKit", font=font(INTER_BOLD, 64), fill=INK)
    d.text((220, 206), "Query · Schema · Compare · Apex", font=font(INTER_SEMI, 26), fill=ACCENT)
    d.text(
        (72, 290),
        "Work in the Salesforce org already open in Chrome.\nNo extra login. Session stays in the browser.",
        font=font(INTER, 24),
        fill=MUTED,
        spacing=8,
    )
    chips = ["Query", "Schema", "Compare", "Apex"]
    x = 72
    y = 400
    for label in chips:
        tw = d.textlength(label, font=font(INTER_SEMI, 18))
        w = int(tw) + 28
        rounded_rect(d, (x, y, x + w, y + 40), 20, (33, 38, 45, 255), BORDER, 1)
        d.text((x + 14, y + 9), label, font=font(INTER_SEMI, 18), fill=TEXT)
        x += w + 10
    # right UI crop
    if home.exists():
        shot = Image.open(home).convert("RGBA")
        # crop the tool grid area
        crop = shot.crop((40, 70, 1240, 760)).resize((720, 430), Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (740, 450), (0, 0, 0, 0))
        fd = ImageDraw.Draw(frame)
        rounded_rect(fd, (0, 0, 739, 449), 18, CARD, BORDER, 2)
        mask = Image.new("L", crop.size, 0)
        md = ImageDraw.Draw(mask)
        md.rounded_rectangle((0, 0, crop.width - 1, crop.height - 1), 12, fill=255)
        framed = Image.new("RGBA", (720, 430), (0, 0, 0, 0))
        framed.paste(crop, (0, 0))
        framed.putalpha(mask)
        frame.alpha_composite(framed, (10, 10))
        im.alpha_composite(frame, (630, 55))
    return im.convert("RGB")


def archive_old() -> None:
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    for name in ARCHIVE_NAMES:
        src = SHOTS / name
        if src.exists():
            shutil.move(str(src), str(ARCHIVE / name))


def main() -> None:
    PROMO.mkdir(parents=True, exist_ok=True)
    archive_old()
    for out_name, html_name in CAPTURES.items():
        capture(html_name, SHOTS / out_name)
        print("shot", out_name)
    small = make_small_promo()
    small.save(PROMO / "small-promo-440x280.png", "PNG", optimize=True)
    marquee = make_marquee(SHOTS / "home-1280x800.png")
    marquee.save(PROMO / "marquee-promo-1400x560.png", "PNG", optimize=True)
    print("promo written")


if __name__ == "__main__":
    main()
