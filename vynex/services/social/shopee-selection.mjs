export const nicheResearch=[
 {id:'casa',name:'Casa e cozinha',keyword:'organizador cozinha'},
 {id:'tecnologia',name:'Acessórios de tecnologia',keyword:'fone bluetooth'},
 {id:'beleza',name:'Beleza e acessórios',keyword:'kit pincel maquiagem'},
 {id:'moda',name:'Moda feminina',keyword:'vestido feminino'},
 {id:'bolsas',name:'Bolsas e acessórios',keyword:'bolsa feminina'},
 {id:'pets',name:'Produtos para pets',keyword:'pet brinquedo'},
 {id:'fitness',name:'Fitness e acessórios',keyword:'elastico treino'},
 {id:'ferramentas',name:'Ferramentas',keyword:'kit ferramentas'}
];
export function rankProducts(products){
 const unique=[...new Map(products.map(p=>[p.itemId,p])).values()];
 return unique.filter(p=>Number(p.rating)>=4.7&&Number(p.sales)>=100&&Number(p.priceMin)>=15&&Number(p.priceMin)<=300&&Number(p.commissionRate)>0&&p.affiliateUrl&&p.imageUrl)
 .map(p=>({...p,editorialScore:Math.round((Math.log10(Number(p.sales)+1)*12+Number(p.rating)*5+Math.min(Number(p.commissionRate),.2)*50)*10)/10,scoreMeaning:'Prioridade editorial entre os produtos consultados; não é probabilidade de venda nem ranking global.'}))
 .sort((a,b)=>b.editorialScore-a.editorialScore||Number(b.sales)-Number(a.sales));
}
export function selectDailyProducts(ranked,count=3){const selected=[],niches=new Set();for(const p of ranked){if(niches.has(p.nicheId))continue;selected.push(p);niches.add(p.nicheId);if(selected.length===count)return selected;}for(const p of ranked){if(selected.some(s=>s.itemId===p.itemId))continue;selected.push(p);if(selected.length===count)break;}return selected;}
export async function researchShopeeSelection({store,api,clock=()=>new Date()}){
 const products=[],errors=[];
 for(const niche of nicheResearch){try{products.push(...(await api.offers(niche.keyword,30)).map(p=>({...p,nicheId:niche.id,nicheName:niche.name})));}catch(e){errors.push({niche:niche.name,message:e.message});}await new Promise(r=>setTimeout(r,600));}
 if(!products.length)throw Error('Nenhum produto retornado pela Shopee. '+(errors[0]?.message||''));
 const now=clock().toISOString(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(clock());
 const ranked=rankProducts(products),selected=selectDailyProducts(ranked);
 const result={id:'shopee-product-selection',checkedAt:now,day,candidates:products.length,eligible:ranked.length,niches:nicheResearch,selected,topProducts:ranked.slice(0,24),errors,growthStatus:'Histórico iniciado; uma única consulta não comprova crescimento.',publicationEnabled:false,dailyVideoTarget:3};
 store.put('shopee-api',result);
 const previous=store.get('shopee-observations-'+day,'shopee-observations');
 store.put('shopee-observations',{id:'shopee-observations-'+day,day,firstObservedAt:previous?.firstObservedAt||now,checkedAt:now,products});
 return result;
}
