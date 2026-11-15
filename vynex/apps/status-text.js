export function gtaPreparationMessage(error){
 if(!error)return 'Preparação sem pendências registradas.';
 if(/Fala \d+ longa demais/.test(error))return 'Uma fala não coube no tempo do vídeo. O corte está bloqueado até a dublagem ser ajustada e validada.';
 if(/Traceback|python\.exe|RuntimeError/.test(error))return 'A preparação da dublagem encontrou um erro. Nenhum novo corte foi liberado por esta tentativa.';
 return String(error).slice(0,240);
}
