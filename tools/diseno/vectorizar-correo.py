"""Traza la carta generada a SVG con los tres colores planos de Aulify.

python tools/diseno/vectorizar-correo.py origen.png destino.svg
Dependencias: Pillow, numpy, vtracer==0.6.12.
"""
import sys
import tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
import vtracer

source, target = map(Path, sys.argv[1:3])
rgba = np.array(Image.open(source).convert("RGBA"))
palette = np.array([[32, 32, 32], [255, 255, 255], [133, 189, 110]])
distance = ((rgba[:, :, None, :3].astype(float) - palette) ** 2).sum(axis=3)
rgba[:, :, :3] = palette[distance.argmin(axis=2)]
rgba[:, :, 3] = np.where(rgba[:, :, 3] >= 128, 255, 0)
with tempfile.TemporaryDirectory() as folder:
    flat = Path(folder) / "carta.png"
    Image.fromarray(rgba).save(flat)
    vtracer.convert_image_to_svg_py(
        str(flat), str(target), colormode="color", hierarchical="stacked",
        mode="spline", filter_speckle=10, color_precision=6, layer_difference=24,
        corner_threshold=60, length_threshold=4.0, max_iterations=10,
        splice_threshold=45, path_precision=2,
    )
tree = ET.parse(target)
root = tree.getroot()
root.set("viewBox", f"0 0 {rgba.shape[1]} {rgba.shape[0]}")
ET.register_namespace("", "http://www.w3.org/2000/svg")
tree.write(target, encoding="unicode")
paths = root.findall("{http://www.w3.org/2000/svg}path")
assert paths and not root.findall(".//{http://www.w3.org/2000/svg}image")
print(f"{target.name}: {len(paths)} trazados; {target.stat().st_size} bytes")
