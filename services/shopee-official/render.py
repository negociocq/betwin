import json,sys,subprocess,textwrap,os
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
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
clean=[i for i in images if i.get('kind')=='ai-illustration']; scenes=(clean or images)[:4]
if len(scenes)==1: scenes=[scenes[0]]*3
def frame(item,index,height=1920):
 scale=height/1920; yy=lambda y:round(y*scale); canvas=Image.new('RGB',(1080,height),'#101216'); d=ImageDraw.Draw(canvas)
 d.rounded_rectangle((60,yy(70),400,yy(132)),radius=20,fill='#ff773b'); d.text((82,yy(81)),'ACHADOS SHOPEE',font=font(round(29*scale),True),fill='white')
 d.text((60,yy(175)),item['label'].upper(),font=font(round(25*scale),True),fill='#c8c9ce'); d.text((890,yy(85)),f'{index+1:02d}/{len(scenes):02d}',font=font(round(28*scale)),fill='#a9aab0')
 d.rounded_rectangle((44,yy(245),1036,yy(1285)),radius=30,fill='#fffaf5'); photo=ImageOps.contain(ImageOps.exif_transpose(Image.open(item['file'])).convert('RGB'),(944,yy(984)),Image.Resampling.LANCZOS); canvas.paste(photo,((1080-photo.width)//2,yy(765)-photo.height//2))
 title=textwrap.wrap(request['productName'],width=36)
 for n,line in enumerate(title[:2]): d.text((60,yy(1340+n*62)),line+('...' if n==1 and len(title)>2 else ''),font=font(round(40*scale),True),fill='white')
 d.rounded_rectangle((60,yy(1580),1020,yy(1680)),radius=22,fill='#ff773b'); d.text((215,yy(1604)),'VEJA O PRODUTO NA SHOPEE',font=font(round(37*scale),True),fill='#16120f')
 note='Ilustracao por IA - confira o modelo no anuncio.' if item['kind']=='ai-illustration' else 'Foto do anuncio - modelo e cor conforme a oferta.'; d.text((60,yy(1730)),note,font=font(round(25*scale)),fill='#d6c6b9'); d.text((60,yy(1780)),'Confira os itens inclusos e a disponibilidade.',font=font(round(25*scale)),fill='#aaaeb6'); d.text((60,yy(1850)),'PUBLICIDADE - LINK DE AFILIADO',font=font(round(24*scale),True),fill='#9c9fa7'); return canvas
frame(images[0],0,1620).save(folder/'pin.png',optimize=True)
ffmpeg=ROOT/'.tools/ffmpeg/bin/ffmpeg.exe'; segments=[]
for i,item in enumerate(scenes):
 image=folder/f'scene-{i:02d}.png'; frame(item,i).save(image); count=288//len(scenes)+(1 if i<288%len(scenes) else 0); segment=folder/f'scene-{i:02d}.mp4'; segments.append(segment)
 vf=f"zoompan=z='1+0.025*on/{count}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={count}:s=1080x1920:fps=24,format=yuv420p"; subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',str(image),'-vf',vf,'-frames:v',str(count),'-c:v','libx264','-preset','veryfast','-crf','19','-threads','3',str(segment)],check=True)
playlist=folder/'scenes.txt'; playlist.write_text('\n'.join("file '"+str(p).replace('\\','/')+"'" for p in segments),encoding='utf-8'); subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(playlist),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','12','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart',str(folder/'video.mp4')],check=True)
narration_text=f"{request['productName']}. Confira preco, variacoes e disponibilidade no anuncio da Shopee."; inp=folder/'narration-input.json'; inp.write_text(json.dumps([narration_text],ensure_ascii=False),encoding='utf-8'); speech=ROOT/'scripts/speech.ps1'; speech_dir=folder/'speech'
voices=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(speech),'-Operation','voices'],capture_output=True,text=True,encoding='utf-8',check=True); rows=json.loads(voices.stdout.strip() or '[]'); pt=[v.get('name') for v in rows if v.get('culture')=='pt-BR' and v.get('enabled')]
if not pt: raise RuntimeError('Nenhuma voz pt-BR instalada para narracao')
voice=os.environ.get('TTS_VOICE') or pt[0]; subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',str(speech),'-Operation','synthesize','-InputFile',str(inp),'-OutputDirectory',str(speech_dir),'-Voice',voice,'-Rate','0'],capture_output=True,text=True,encoding='utf-8',check=True)
srt=folder/'captions.srt'; srt.write_text('1\n00:00:00,000 --> 00:00:05,500\n'+request['productName'][:90]+'\n\n2\n00:00:05,500 --> 00:00:12,000\nConfira preco, variacoes e disponibilidade no anuncio da Shopee.\n',encoding='utf-8'); sub=str(srt).replace('\\','/').replace(':','\\:'); final=folder/'video-narrated.mp4'
sub_filter=f"subtitles='{sub}':force_style='FontName=Segoe UI,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H99000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=90'"
subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',str(folder/'video.mp4'),'-i',str(speech_dir/'speech-000.wav'),'-vf',sub_filter,'-map','0:v:0','-map','1:a:0','-t','12','-c:v','libx264','-preset','veryfast','-crf','19','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',str(final)],check=True); final.replace(folder/'video.mp4')
report={'renderer':'product-scenes-v3','thirdPartyImagesUsed':True,'physicalDemonstration':False,'duration':12,'language':'pt-BR','sceneCount':len(scenes),'sourceImageCount':request.get('sourceImageCount',1),'illustrationCount':request.get('illustrationCount',0),'aiIllustrationsLabeled':True,'imageKinds':[i['kind'] for i in images],'narration':True,'subtitles':True,'narrationVoice':voice,'narrationText':narration_text}; (folder/'visuals.json').write_text(json.dumps(report,ensure_ascii=False),encoding='utf-8'); print(json.dumps(report,ensure_ascii=False))
