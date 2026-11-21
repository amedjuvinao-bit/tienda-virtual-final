"""Refresh the checked-in fonts from Google Fonts and retain their OFL licenses.

Optional maintenance script; normal development/build never downloads fonts.
Uses the same families/styles as the storefront and appearance editor.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1] / "public" / "fonts"
DEST = ROOT / "local"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
FAMILIES = {
    "Baloo 2": "wght@600;700", "Barlow Condensed": "wght@600",
    "Cormorant Garamond": "ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600;1,700",
    "Dancing Script": "wght@600", "IBM Plex Mono": "wght@500",
    "IBM Plex Sans": "wght@400;500;600;700", "IBM Plex Serif": "wght@500;600;700",
    "Libre Baskerville": "wght@400;700", "Lora": "wght@400;500;600;700",
    "Manrope": "wght@400;500;600;700;800",
    "Playfair Display": "ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400",
    "Source Sans 3": "wght@400;500;600;700", "Space Grotesk": "wght@400;500;600;700",
    "Jost": "wght@300;400;500;600", "Mulish": "wght@300;400;500;600;700",
    "Inter": "wght@300;400;500;600;700;800;900",
    "Poppins": "wght@300;400;500;600;700;800;900",
    "Montserrat": "wght@300;400;500;600;700;800;900",
    "DM Serif Display": "ital@0;1", "Nunito": "wght@300;400;500;600;700;800;900",
    "Raleway": "wght@300;400;500;600;700;800;900",
}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as response:
        return response.read()

def family_sources(item):
    family, axes = item
    url = "https://fonts.googleapis.com/css2?family=" + urllib.parse.quote_plus(family) + ":" + axes + "&display=swap"
    css = fetch(url).decode("utf8")
    slug = family.lower().replace(" ", "")
    license_url = f"https://raw.githubusercontent.com/google/fonts/main/ofl/{slug}/OFL.txt"
    license_data = fetch(license_url)
    if b"SIL OPEN FONT LICENSE" not in license_data:
        raise ValueError("Unrecognized font license: " + family)
    faces = []
    for face in re.findall(r"@font-face\s*\{[^}]+\}", css):
        source = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", face)
        if not source:
            raise ValueError("Unexpected font source: " + family)
        faces.append((face, source.group(1)))
    if not faces:
        raise ValueError("No font faces: " + family)
    return family, slug, license_url, license_data, faces

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        sources = list(executor.map(family_sources, FAMILIES.items()))
        urls = sorted({url for *_, faces in sources for _, url in faces})
        downloaded = dict(zip(urls, executor.map(fetch, urls)))
    manifest, styles, written = [], ["/* Vendored Google Fonts. Licenses and source hashes: local/manifest.json. */"], set()
    for family, slug, license_url, license_data, faces in sources:
        (DEST / (slug + "-OFL.txt")).write_bytes(license_data)
        entries = []
        for face, url in faces:
            data = downloaded[url]
            if not data.startswith(b"wOF2"):
                raise ValueError("Expected WOFF2 font: " + family)
            digest = hashlib.sha256(data).hexdigest()
            filename = slug + "-" + digest[:16] + ".woff2"
            (DEST / filename).write_bytes(data)
            written.add(filename)
            styles.append(face.replace(url, "/fonts/local/" + filename))
            entries.append({"file": filename, "source": url, "sha256": digest})
        manifest.append({"family": family, "axes": FAMILIES[family], "license": slug + "-OFL.txt", "licenseSource": license_url,
                         "licenseSha256": hashlib.sha256(license_data).hexdigest(), "faces": entries})
    (ROOT / "storefront-fonts.css").write_text("\n\n".join(styles) + "\n")
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"families": len(manifest), "files": len(written), "bytes": sum((DEST / f).stat().st_size for f in written)}))

if __name__ == "__main__":
    main()
