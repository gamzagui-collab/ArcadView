"""Reproduce the tiny offline CAD symbol fallback with fonttools==4.68.0.

Input: Noto Sans KR VF from the Sans2.004 release, SHA-256 below.
python scripts/build-cad-symbol-font.py INPUT.ttf public/fonts/IzCadSymbols-Regular.ttf
"""
import hashlib
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

source, destination = map(Path, sys.argv[1:])
expected = "9e1d729e7e2b36f9ef439da102f8c134c10aabe46f1c843bf0aca5c043b86f76"
if hashlib.sha256(source.read_bytes()).hexdigest() != expected:
    raise ValueError("Unexpected Noto Sans KR source font")

font = TTFont(source, recalcTimestamp=False)
font = instantiateVariableFont(font, {"wght": 400}, inplace=True)
options = subset.Options()
options.hinting = False
options.recalc_timestamp = False
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14, 16, 17]
options.name_languages = [0x409, 0x412]
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=[0x2205, 0x33A1])  # Diameter/empty-set and square metre.
subsetter.subset(font)
names = {1: "izCAD Symbols", 2: "Regular", 3: "IzCADSymbols-1.0",
         4: "izCAD Symbols Regular", 5: "Version 1.0", 6: "IzCADSymbols-Regular",
         16: "izCAD Symbols", 17: "Regular"}
for record in list(font["name"].names):
    if record.nameID in names:
        font["name"].setName(names[record.nameID], record.nameID,
                             record.platformID, record.platEncID, record.langID)
destination.parent.mkdir(parents=True, exist_ok=True)
font.save(destination)
print(f"Saved {destination}: {destination.stat().st_size} bytes")
