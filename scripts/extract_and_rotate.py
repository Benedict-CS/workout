import os, glob
from PIL import Image

# First, ensure all 17 PDFs are rotated 90 degrees and saved to a clean folder
pdf_files = sorted(glob.glob('C:/Users/king/Downloads/Inbody/*.pdf'))
from pypdf import PdfReader
import io

os.makedirs('F:/workout/scripts/inbody_correct', exist_ok=True)

for idx, pf in enumerate(pdf_files):
    reader = PdfReader(pf)
    for p in reader.pages:
        for img_obj in p.images:
            img = Image.open(io.BytesIO(img_obj.data))
            # Rotate 90 degrees clockwise
            rot = img.rotate(90, expand=True)
            base = os.path.basename(pf).replace('.pdf', '')
            out_path = f'F:/workout/scripts/inbody_correct/{idx:02d}_{base}.png'
            rot.save(out_path)
            break

print(f"Extracted and rotated {len(pdf_files)} InBody report images!")
