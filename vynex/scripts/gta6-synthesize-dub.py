"""Preset Portuguese voices aligned to dialogue. The English audio is not muxed."""
import os,sys,json,subprocess,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ['HF_HUB_OFFLINE']='1';sys.path.insert(0,str(ROOT/'.tools/supertonic-2/source'))
import helper,numpy as np,soundfile as sf,onnxruntime as ort
request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
model=ROOT/'.tools/supertonic-2/model';opts=ort.SessionOptions();opts.intra_op_num_threads=4;opts.inter_op_num_threads=1
sessions=helper.load_onnx_all(str(model/'onnx'),opts,['CPUExecutionProvider'])
tts=helper.TextToSpeech(helper.load_cfgs(str(model/'onnx')),helper.load_text_processor(str(model/'onnx')),*sessions)
style=helper.load_voice_style([str(model/'voice_styles/M1.json')]);ffmpeg=ROOT/'.tools/ffmpeg/bin/ffmpeg.exe'
for clip in request['clips']:
    folder=Path(clip['folder']);plan=json.loads(Path(clip['plan']).read_text(encoding='utf-8'));sr=tts.sample_rate
    timeline=np.zeros(round(plan['duration']*sr),dtype=np.float32);rows=plan['segments'];report=[]
    for index,row in enumerate(rows):
        start=max(0,float(row['start']));end=min(plan['duration'],rows[index+1]['start']-.04 if index+1<len(rows) else plan['duration']);available=max(.25,end-start)
        signature=hashlib.sha256(row['text'].encode('utf-8')).hexdigest()[:10];wavefile=folder/f'dub-line-{index:02d}-{signature}.wav'
        if wavefile.exists():audio,rate=sf.read(wavefile,dtype='float32');assert rate==sr
        else:
            np.random.seed(42+index);wave,_=tts(row['text'],lang='pt',style=style,total_step=5,speed=1.05,silence_duration=.1)
            audio=np.asarray(wave,dtype=np.float32).reshape(-1)
            active=np.flatnonzero(np.abs(audio)>.006)
            if len(active):audio=audio[max(0,active[0]-round(.04*sr)):min(len(audio),active[-1]+round(.10*sr))]
            if not len(audio) or not np.isfinite(audio).all():raise RuntimeError('Fala inválida')
            sf.write(wavefile,audio,sr,subtype='FLOAT')
        ratio=max(1,len(audio)/sr/available)
        if ratio>1.65:raise RuntimeError(f'Fala {index} longa demais ({ratio:.2f}x); revise a tradução: '+row['text'])
        if ratio>1.01:
            fitted=folder/f'dub-fit-{index:02d}.wav';subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',str(wavefile),'-af',f'atempo={ratio:.6f}',str(fitted)],check=True);audio,_=sf.read(fitted,dtype='float32')
        offset=round(start*sr);length=min(len(audio),len(timeline)-offset,round(available*sr));timeline[offset:offset+length]+=audio[:length]
        report.append({'index':index,'start':start,'available':available,'tempo':ratio,'text':row['text']})
    peak=float(np.abs(timeline).max());
    if peak<=.001:raise RuntimeError('Dublagem silenciosa')
    timeline*=.85/max(.85,peak);audiofile=folder/'dub-audio-ptbr.wav';sf.write(audiofile,timeline,sr,subtype='FLOAT')
    output=folder/'dubbed-ptbr.mp4'
    subprocess.run([str(ffmpeg),'-hide_banner','-loglevel','error','-y','-i',clip['file'],'-i',str(audiofile),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(plan['duration']),'-movflags','+faststart','-metadata:s:a:0','language=por',str(output)],check=True)
    (folder/'synthesis-report.json').write_text(json.dumps({'language':'pt-BR','sampleRate':sr,'originalAudioIncluded':False,'segments':report},ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'folder':str(folder),'dubbed':True,'segments':len(report)}),flush=True)
