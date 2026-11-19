"""Build the single offline drawing font from the two bundled OFL fonts."""
from pathlib import Path
from copy import deepcopy
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
font = TTFont(root / 'public/fonts/NanumGothic-Regular.ttf', recalcTimestamp=False)
symbols = TTFont(root / 'public/fonts/IzCadSymbols-Regular.ttf', recalcTimestamp=False)
assert font['head'].unitsPerEm == symbols['head'].unitsPerEm
cmap, extra = font.getBestCmap(), symbols.getBestCmap()
order = list(font.getGlyphOrder())
for code, name in extra.items():
    if code in cmap:
        continue
    glyph = deepcopy(symbols['glyf'][name])
    assert not glyph.isComposite(), 'Review dependencies before adding a composite glyph'
    new_name = f'cad_uni{code:04X}'
    font['glyf'][new_name] = glyph
    font['hmtx'].metrics[new_name] = symbols['hmtx'].metrics[name]
    order.append(new_name)
    for table in font['cmap'].tables:
        if table.isUnicode():
            table.cmap[code] = new_name
font.setGlyphOrder(order)
font['glyf'].glyphOrder = order
names = {1:'izCAD Universal',2:'Regular',3:'IzCADUniversal-1.0',4:'izCAD Universal Regular',5:'Version 1.0',6:'IzCADUniversal-Regular',16:'izCAD Universal',17:'Regular'}
for record in list(font['name'].names):
    if record.nameID in names:
        font['name'].setName(names[record.nameID],record.nameID,record.platformID,record.platEncID,record.langID)
font.save(root / 'public/fonts/IzCadUniversal-Regular.ttf')
print('Built IzCadUniversal-Regular.ttf; preserved original fonts and their licenses')
