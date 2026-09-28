"""Reproduce el trazado vectorial sin sustituir ni alterar el PNG de origen.

Dependencia: python -m pip install vtracer==0.6.12
Ejecución desde la raíz: python tools/diseno/vectorizar-cuaderno.py
"""
from pathlib import Path
import xml.etree.ElementTree as ET

import vtracer

ROOT = Path(__file__).resolve().parents[2]
source = ROOT / "public/illustrations/cuaderno.png"
target = ROOT / "public/illustrations/cuaderno.svg"
vtracer.convert_image_to_svg_py(
    str(source), str(target), colormode="color", hierarchical="stacked",
    mode="spline", filter_speckle=10, color_precision=4, layer_difference=24,
    corner_threshold=60, length_threshold=4.0, max_iterations=10,
    splice_threshold=45, path_precision=2,
)
tree = ET.parse(target)
svg = tree.getroot()
paths = svg.findall("{http://www.w3.org/2000/svg}path")
if not paths or svg.findall(".//{http://www.w3.org/2000/svg}image"):
    raise ValueError("Se esperaba un SVG de trazados, sin imágenes incrustadas.")
print(f"{target.name}: {len(paths)} trazados, {target.stat().st_size} bytes")
