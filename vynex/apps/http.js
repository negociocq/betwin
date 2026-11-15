export async function apiJson(response){
 if(!response.headers.get('content-type')?.includes('application/json'))throw Object.assign(Error('O serviço do Vynex não está disponível neste endereço. A apresentação pode abrir, mas o painel precisa do servidor de login e dados.'),{code:'BACKEND_UNAVAILABLE'});
 let body;try{body=await response.json();}catch{throw Object.assign(Error('O serviço do Vynex retornou uma resposta incompleta. Tente novamente.'),{code:'BACKEND_UNAVAILABLE'});}
 if(!response.ok)throw Object.assign(Error(body.error||'Não foi possível concluir a solicitação.'),{code:response.status===401?'AUTH_REQUIRED':body.code,status:response.status});return body;
}
export async function loadSession(fetchImpl=fetch){const body=await apiJson(await fetchImpl('/api/auth/status',{cache:'no-store'}));if(!body||typeof body.needsSetup!=='boolean'||!('user'in body))throw Object.assign(Error('O serviço de acesso do Vynex ainda não está configurado neste endereço.'),{code:'BACKEND_UNAVAILABLE'});return body;}
