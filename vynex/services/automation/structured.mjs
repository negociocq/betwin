export class StructuredError extends Error{constructor(message,code='MODEL_STRUCTURE'){super(message);this.code=code;}}
// Runtime validation is independent of the model's constrained sampler. String
// lengths are checked here; they must never be enforced by truncating content.
export function validateStructured(value,schema,path='$'){
 if(!schema)return value;
 const type=Array.isArray(value)?'array':value===null?'null':typeof value;
 if(schema.type&&(schema.type==='integer'?!Number.isInteger(value):type!==schema.type))throw new StructuredError(`${path}: tipo esperado ${schema.type}.`);
 if(schema.enum&&!schema.enum.includes(value))throw new StructuredError(`${path}: valor não permitido.`);
 if(type==='object'){
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))throw new StructuredError(`${path}.${key}: campo ausente.`);
  for(const [key,item]of Object.entries(value)){if(schema.additionalProperties===false&&!Object.hasOwn(schema.properties||{},key))throw new StructuredError(`${path}: campo inesperado.`);if(schema.properties?.[key])validateStructured(item,schema.properties[key],path+'.'+key);}
 }
 if(type==='array'){if(value.length<(schema.minItems??0)||value.length>(schema.maxItems??Infinity))throw new StructuredError(`${path}: quantidade de itens inválida.`);value.forEach((x,i)=>validateStructured(x,schema.items,`${path}[${i}]`));}
 if(type==='string'&&(value.length<(schema.minLength??0)||value.length>(schema.maxLength??Infinity)))throw new StructuredError(`${path}: tamanho de texto inválido.`);
 return value;
}
export function parseModelEnvelope(out,schema){
 if(!out||typeof out.response!=='string'||!out.response.trim())throw new StructuredError('Ollama retornou resposta vazia.','MODEL_EMPTY');
 if(out.done===false||out.done_reason==='length')throw new StructuredError('Ollama atingiu o limite de geração; resposta incompleta.','MODEL_TRUNCATED');
 let value;try{value=JSON.parse(out.response);}catch{throw new StructuredError('Ollama retornou JSON inválido ou comentários fora do JSON.','MODEL_JSON');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new StructuredError('Ollama precisa retornar um objeto JSON.');
 return validateStructured(value,schema);
}
