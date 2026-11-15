"""Offline ASR for GTA clips. Produces timestamps; never invents dialogue."""
import os,sys,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
os.environ['HF_HUB_OFFLINE']='1'
from faster_whisper import WhisperModel
request=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
model=WhisperModel('small',device='cpu',compute_type='int8',cpu_threads=4,download_root=str(ROOT/'.tools/asr'),local_files_only=True)
for clip in request['clips']:
    output=Path(clip['output']);output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():continue
    segments,info=model.transcribe(clip['file'],beam_size=5,word_timestamps=True,condition_on_previous_text=False,vad_filter=True)
    rows=[{'start':s.start,'end':s.end,'text':s.text.strip(),'avgLogProb':s.avg_logprob,'noSpeechProbability':s.no_speech_prob} for s in segments]
    result={'language':info.language,'languageProbability':info.language_probability,'segments':rows}
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'id':clip['id'],**result},ensure_ascii=True),flush=True)
