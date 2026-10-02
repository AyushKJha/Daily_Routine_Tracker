from pathlib import Path
import shutil
root=Path(__file__).resolve().parent
source=root.parent/'static'
assets=root/'app/src/main/assets'
assets.mkdir(parents=True,exist_ok=True)
# Bundle code and library assets only. Journal data never lives in this directory.
for p in source.rglob('*'):
    if not p.is_file():continue
    target=assets/p.relative_to(source)
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(p,target)
shutil.copyfile(root/'native-runtime.js',assets/'native-runtime.js')
p=assets/'index.html';s=p.read_text(encoding='utf-8').replace('<head>', '''<head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'self'"><script src="./native-runtime.js"></script>''')
s=s.replace('YOUR PERSONAL WORKSPACE / ON DEVICE','DAILY FOR ANDROID / ON THIS PHONE')
s=s.replace('Your records stay in this browser on this device.','Your records stay inside this app on this phone.')
s=s.replace('clearing browser data or using private browsing can erase them.','uninstalling or clearing app data can erase them.')
s=s.replace('on this browser','inside this app').replace('in this browser','inside this app').replace('There is no automatic sync. Your workspace ID opens the records held by this browser.','There is no automatic sync. Your workspace ID opens the records held by this app.')
s=s.replace('cleared browser data','cleared app data')
p.write_text(s,encoding='utf-8')
p=assets/'app.js';s=p.read_text(encoding='utf-8').replace("if('serviceWorker' in navigator)","if(!window.DailyAndroid && 'serviceWorker' in navigator)");p.write_text(s,encoding='utf-8')
icons=root/'app/src/main/res/drawable';icons.mkdir(parents=True,exist_ok=True);shutil.copyfile(source/'icon-512.png',icons/'daily_icon.png')
print('Bundled',len(list(assets.rglob('*'))),'asset paths for Android.')
