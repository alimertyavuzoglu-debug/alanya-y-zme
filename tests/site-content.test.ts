import {test} from 'node:test';import assert from 'node:assert/strict';
import {contentSchema,defaultContent,resolveContent} from '../src/lib/site-content';
test('CMS rejects unsafe URL schemes, empty text and unknown keys',()=>{
 assert.equal(contentSchema.safeParse(defaultContent).success,true);
 for(const url of ['javascript:alert(1)','data:image/svg+xml,x','//attacker.example/x','http://example.com/a.png'])assert.equal(contentSchema.safeParse({...defaultContent,heroImage:url}).success,false);
 assert.equal(contentSchema.safeParse({...defaultContent,heroTitle:''}).success,false);
 assert.equal(contentSchema.safeParse({...defaultContent,script:'alert(1)'}).success,false);
});
test('empty initial content resolves approved defaults and respects saved text',()=>{
 assert.deepEqual(resolveContent({}).data,defaultContent);
 assert.equal(resolveContent({heroTitle:'Yeni başlık'}).data?.heroTitle,'Yeni başlık');
});
