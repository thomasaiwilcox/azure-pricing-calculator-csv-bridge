"""Developer-only, dependency-free deterministic unpacked extension packaging."""
from pathlib import Path
import shutil,zipfile,hashlib
root=Path(__file__).resolve().parents[1]
out=root/'dist/extension'
if out.exists():shutil.rmtree(out)
shutil.copytree(root/'extension',out)
shutil.copy(root/'web/import-snippet.js',out/'importer.js')
shutil.copytree(root/'fixtures',out/'fixtures')
shutil.copytree(root/'examples',out/'examples')
shutil.copytree(root/'samples/all-services',out/'samples')
archive=root/'dist/Azure_CSV_Bridge_Extension_v0.5.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for path in sorted(out.rglob('*')):
  if path.is_file():
   info=zipfile.ZipInfo(path.relative_to(out).as_posix(),(2026,10,26,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
   z.writestr(info,path.read_bytes())
archive.with_suffix('.zip.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest()+'  '+archive.name+'\n')
print(archive)
