"""Original affiliate cards: no fetched seller images, fabricated demos, voices or stock footage."""
import json,sys,subprocess,textwrap
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent.parent
request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'));folder=Path(request['folder']).resolve()
if not folder.is_relative_to(ROOT/'storage/shopee-official'):raise RuntimeError('Output outside the Shopee module')
folder.mkdir(parents=True,exist_ok=True)
fontdir=Path('C:/Windows/Fonts')
def font(size,bold=False):return ImageFont.truetype(str(fontdir/('segoeuib.ttf' if bold else 'segoeui.ttf')),size)
im=Image.new('RGB',(1080,1620),'#fff8f2');d=ImageDraw.Draw(im)
d.rounded_rectangle((55,55,1025,1565),radius=42,fill='#ffffff',outline='#f1ded3',width=3)
d.rounded_rectangle((96,100,420,155),radius=22,fill='#ff6a31');d.text((120,108),'ACHADOS SHOPEE',font=font(28,True),fill='white')
d.text((100,218),'Uma oferta para',font=font(47),fill='#39302c');d.text((100,275),'você comparar.',font=font(64,True),fill='#211d1a')
y=435
for line in textwrap.wrap(request['productName'],width=26)[:6]:d.text((100,y),line,font=font(48,True),fill='#332723');y+=66
y=max(y+70,950)
d.rounded_rectangle((100,y,980,y+125),radius=24,fill='#fff0e8');d.text((132,y+23),'Confira preço, variações e frete',font=font(35),fill='#7c412d');d.text((132,y+69),'diretamente no anúncio.',font=font(35),fill='#7c412d')
d.rounded_rectangle((100,1270,980,1378),radius=24,fill='#ee5b2b');d.text((156,1293),'VER DETALHES NA SHOPEE',font=font(39,True),fill='white')
d.text((100,1430),'PUBLICIDADE · LINK DE AFILIADO',font=font(28,True),fill='#554942');d.text((100,1476),'Posso receber comissão por compras elegíveis.',font=font(27),fill='#796c63')
im.save(folder/'pin.png',optimize=True)
video=Image.new('RGB',(1080,1920),'#fff8f2');video.paste(im,(0,150));video.save(folder/'video-frame.png')
ffmpeg=ROOT/'.tools/ffmpeg/bin/ffmpeg.exe'
subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-loop','1','-i',str(folder/'video-frame.png'),'-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t','12','-vf',"scale=1124:1998,crop=1080:1920:x='22+10*sin(t/3)':y='39+10*sin(t/4)',format=yuv420p",'-r','24','-c:v','libx264','-preset','veryfast','-crf','22','-threads','4','-c:a','aac','-b:a','128k','-movflags','+faststart',str(folder/'video.mp4')],check=True)
print(json.dumps({'originalDesign':True,'thirdPartyImagesUsed':False,'physicalDemonstration':False,'duration':12,'language':'pt-BR'}))
