import { describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({data:null as any}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:()=>{const q:any={select:()=>q,eq:()=>q,contains:()=>q,maybeSingle:async()=>({data:state.data,error:null})};return q;}})}));
import { GET } from '../app/api/codex/qripto/essays/[slug]/machine/route';
describe('machine projection keeps the canonical research contract',()=>{
  it('adds editions without replacing canonicalText',async()=>{
    state.data={id:'006',title:'Essay',slug:'essay',tags:['thresholds','essay'],modalities:{read:{text:'Original [^1]\n\n[^1]: Evidence',duration:'35 min read',defaultEdition:'reading',editions:[{id:'reading',label:'Reading Edition',source:'inline',text:'Prose'},{id:'research',label:'Research Edition',source:'canonical'}]}}};
    const response=await GET({} as any,{params:Promise.resolve({slug:'essay'})});
    const body=await response.json();
    expect(body.canonicalText.text).toBe(state.data.modalities.read.text);
    expect(body.defaultReadingEdition).toBe('reading');
    expect(body.readingEditions.map((e:any)=>e.id)).toEqual(['reading','research']);
  });
  it('preserves the legacy machine response for 005',async()=>{
    state.data={id:'005',modalities:{read:{text:'Original 005'}}};
    const body=await (await GET({} as any,{params:Promise.resolve({slug:'trusted-intelligence'})})).json();
    expect(body.canonicalText.text).toBe('Original 005');
    expect(body.readingEditions).toEqual([]);
    expect(body.defaultReadingEdition).toBeNull();
  });
});
