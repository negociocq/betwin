import {createHash} from 'node:crypto';
const endpoint='https://open-api.affiliate.shopee.com.br/graphql';
export function createShopeeAffiliate({store,vault,fetchImpl=fetch,clock=()=>new Date()}){
 const recordId='shopee-affiliate-connection';
 async function query(query,variables){
  const credential=await vault.load();if(!credential?.appId||!credential?.secret)throw Error('Cadastre as credenciais da Shopee.');
  const body=JSON.stringify({query,...(variables?{variables}:{})}),timestamp=String(Math.floor(clock().getTime()/1000));
  const signature=createHash('sha256').update(credential.appId+timestamp+body+credential.secret).digest('hex');
  let response;try{response=await fetchImpl(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${credential.appId}, Timestamp=${timestamp}, Signature=${signature}`},body,signal:AbortSignal.timeout(25000)});}catch{throw Error('Não foi possível acessar a API oficial da Shopee. Tente novamente.');}
  if(!response.ok)throw Error('Shopee respondeu HTTP '+response.status+'.');
  const payload=await response.json();
  if(payload.errors?.length){const code=payload.errors[0]?.extensions?.code;const error=Error('Shopee recusou a consulta'+(code?' (código '+code+')':'')+'. '+({10000:'Use um termo mais específico, como "vestido feminino" ou "camiseta masculina".',10020:'Confira as credenciais e o horário do computador.',10030:'Limite de consultas atingido. Aguarde.',10035:'A Shopee ainda não liberou o acesso da API para esta conta.'}[code]||'A consulta não foi aceita pela API.'));error.shopeeCode=String(code||'');throw error;}
  if(!payload.data?.productOfferV2?.nodes)throw Error('A Shopee não retornou a lista de produtos esperada.');
  return payload.data.productOfferV2;
 }
 async function status(){return {credentialsSaved:await vault.exists(),verified:false,status:'awaiting-official-api-validation',...store.get(recordId,'shopee-api'),selection:store.get('shopee-product-selection','shopee-api')||null,results:store.get('shopee-affiliate-results','shopee-api')?.products||[]};}
 const fallbackKeyword=keyword=>({roupas:'vestido feminino',roupa:'vestido feminino',moda:'vestido feminino',vestuário:'vestido feminino',vestuario:'vestido feminino',eletrônicos:'acessórios celular',eletronicos:'acessorios celular'}[(keyword||'').trim().toLowerCase()]||keyword);
 async function offers(keyword,limit=30){
  if(typeof keyword!=='string'||keyword.length>100||!Number.isInteger(limit)||limit<1||limit>50)throw Error('Pesquisa de produtos inválida.');
  let result;try{result=await query(`query VynexCandidates($keyword: String!, $limit: Int!) { productOfferV2(keyword: $keyword, limit: $limit, page: 1, sortType: 2) { nodes { itemId productName priceMin priceMax sales ratingStar commissionRate offerLink imageUrl productLink shopName } } }`,{keyword,limit});}catch(error){if(error.shopeeCode!=='10000'||fallbackKeyword(keyword)===keyword)throw error;result=await query(`query VynexCandidates($keyword: String!, $limit: Int!) { productOfferV2(keyword: $keyword, limit: $limit, page: 1, sortType: 2) { nodes { itemId productName priceMin priceMax sales ratingStar commissionRate offerLink imageUrl productLink shopName } } }`,{keyword:fallbackKeyword(keyword),limit});}
  const checkedAt=clock().toISOString();
  return result.nodes.map(p=>({itemId:String(p.itemId),name:p.productName,priceMin:p.priceMin,priceMax:p.priceMax,sales:p.sales,rating:p.ratingStar,commissionRate:p.commissionRate,affiliateUrl:p.offerLink,imageUrl:p.imageUrl,productUrl:p.productLink,shopName:p.shopName,checkedAt,source:'Shopee Affiliate API'}));
 }
 async function search(input={}){
  if(Object.keys(input).some(k=>!['keyword','limit'].includes(k))||typeof(input.keyword??'')!=='string'||(input.keyword||'').length>100)throw Error('Informe uma busca com até 100 caracteres.');
  const keyword=(input.keyword||'').trim(),limit=input.limit??6;if(!Number.isInteger(limit)||limit<1||limit>30)throw Error('Limite de pesquisa invalido.');
  try{
   const result=await query(`query VynexProducts($keyword: String!, $limit: Int!) { productOfferV2(keyword: $keyword, limit: $limit, page: 1) { nodes { itemId productName priceMin priceMax sales ratingStar commissionRate offerLink imageUrl productLink shopName } pageInfo { hasNextPage } } }`,{keyword,limit});
   const checkedAt=clock().toISOString();
   const products=result.nodes.map(p=>({itemId:String(p.itemId),name:p.productName,priceMin:p.priceMin,priceMax:p.priceMax,sales:p.sales,rating:p.ratingStar,commissionRate:p.commissionRate,affiliateUrl:p.offerLink,imageUrl:p.imageUrl,productUrl:p.productLink,shopName:p.shopName,checkedAt,source:'Shopee Affiliate API'}));
   store.put('shopee-api',{id:recordId,verified:true,status:'connected',checkedAt,message:'Consulta autenticada confirmada na API oficial da Shopee.'});
   store.put('shopee-api',{id:'shopee-affiliate-results',keyword,products,checkedAt});
   return status();
  }catch(e){store.put('shopee-api',{id:recordId,verified:false,status:'verification_failed',checkedAt:clock().toISOString(),message:e.message});throw e;}
 }
 return {status,search,offers,verify:()=>search({keyword:''}),reset:()=>{store.remove('shopee-affiliate-results','shopee-api');return store.put('shopee-api',{id:recordId,verified:false,status:'awaiting-official-api-validation'});}};
}
