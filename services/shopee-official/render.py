import json,sys,subprocess,textwrap,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
ROOT=Path(__file__).resolve().parent.parent.parent
request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'));folder=Path(request['folder']).resolve()
if not folder.is_relative_to(ROOT/'storage/shopee-official'): raise RuntimeError('Output outside Shopee module')
folder.mkdir(parents=True,exist_ok=True); fontdir=Path('C:/Windows/Fonts')
def font(size,bold=False): return ImageFont.truetype(str(fontdir/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)
images=request.get('images') or []
if not images or images[0].get('kind')!='source': raise RuntimeError('Real source photo required')
for n,item in enumerate(images):
 file=Path(item['file']).resolve()
 if not file.is_relative_to(ROOT/'storage/shopee-official/product-media'): raise RuntimeError('Image outside product media')
 with Image.open(file) as photo:
  if photo.width*photo.height>40000000: raise RuntimeError('Product image too large')
  photo.verify()
 ImageOps.exif_transpose(Image.open(file)).convert('RGB').save(folder/f'product-image-{n}.png')
# Use only photos supplied by the listing. AI illustrations are kept in the
# gallery for reference but never used as the sales video source.
base=[i for i in images if i.get('kind')=='source']
scenes=[base[i % len(base)] for i in range(6)]
def frame(item,index,height=1920):
 photo=ImageOps.exif_transpose(Image.open(item['file'])).convert('RGB')
 backdrop=ImageOps.fit(photo,(1080,height),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(32))
 canvas=Image.blend(backdrop,Image.new('RGB',(1080,height),'#16181d'),0.68)
 product=ImageOps.contain(photo,(930,1450),Image.Resampling.LANCZOS)
 x=(1080-product.width)//2; y=(height-product.height)//2
 shadow=Image.new('RGBA',(product.width+80,product.height+80),(0,0,0,0)); sd=ImageDraw.Draw(shadow); sd.rounded_rectangle((40,40,product.width+40,product.height+40),radius=35,fill=(0,0,0,110)); shadow=shadow.filter(ImageFilter.GaussianBlur(28)); canvas.paste(shadow,(x-40,y+20),shadow)
 canvas.paste(product,(x,y)); return canvas
frame(images[0],0,1620).save(folder/'pin.png',optimize=True)
ffmpeg=ROOT/'.tools/ffmpeg/bin/ffmpeg.exe'; segments=[]
for i,item in enumerate(scenes):
 image=folder/f'scene-{i:02d}.png'; frame(item,i).save(image); count=576//len(scenes)+(1 if i<576%len(scenes) else 0); segment=folder/f'scene-{i:02d}.mp4'; segments.append(segment)
 vf=f"zoompan=z='1+0.025*on/{count}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={count}:s=1080x1920:fps=24,format=yuv420p"; subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',str(image),'-vf',vf,'-frames:v',str(count),'-c:v','libx264','-preset','veryfast','-crf','19','-threads','3',str(segment)],check=True)
playlist=folder/'scenes.txt'; playlist.write_text('\n'.join("file '"+str(p).replace('\\','/')+"'" for p in segments),encoding='utf-8'); subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(playlist),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','24','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',str(folder/'video.mp4')],check=True)
narration_text=f"{request['productName']}. Veja os detalhes do produto, confira as opcoes disponiveis e consulte preco, variacoes e disponibilidade diretamente no anuncio da Shopee."; inp=folder/'narration-input.json'; inp.write_text(json.dumps([narration_text],ensure_ascii=False),encoding='utf-8'); speech=ROOT/'scripts/speech.ps1'; speech_dir=folder/'speech'
voices=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(speech),'-Operation','voices'],capture_output=True,text=True,encoding='utf-8',check=True); rows=json.loads(voices.stdout.strip() or '[]'); pt=[v.get('name') for v in rows if v.get('culture')=='pt-BR' and v.get('enabled')]
if not pt: raise RuntimeError('Nenhuma voz pt-BR instalada para narracao')
voice=os.environ.get('TTS_VOICE') or pt[0]; subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(speech),'-Operation','synthesize','-InputFile',str(inp),'-OutputDirectory',str(speech_dir),'-Voice',voice,'-Rate','0'],capture_output=True,text=True,encoding='utf-8',check=True)
final=folder/'video-narrated.mp4'
subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',str(folder/'video.mp4'),'-i',str(speech_dir/'speech-000.wav'),'-map','0:v:0','-map','1:a:0','-t','24','-c:v','libx264','-preset','veryfast','-crf','19','-c:a','aac','-b:a','128k','-movflags','+faststart',str(final)],check=True); final.replace(folder/'video.mp4')
report={'renderer':'product-scenes-v5-real-photos','thirdPartyImagesUsed':True,'physicalDemonstration':False,'duration':24,'language':'pt-BR','sceneCount':len(scenes),'sourceImageCount':request.get('sourceImageCount',1),'illustrationCount':request.get('illustrationCount',0),'aiIllustrationsLabeled':True,'imageKinds':[i['kind'] for i in images],'narration':True,'subtitles':False,'narrationVoice':voice,'narrationText':narration_text}; (folder/'visuals.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8'); print(json.dumps(report,ensure_ascii=False))



