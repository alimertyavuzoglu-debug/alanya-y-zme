import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {publicPages,courses,getPublicPage,resolvePage,pageImage} from '../src/lib/public-pages';
import {contentSchema,defaultContent,resolveContent} from '../src/lib/site-content';
import {publicHref,publicImage} from '../src/lib/public-markup';
test('legacy pages, programme destinations and their public photographs are available',()=>{
 assert.equal(publicPages.length,47);assert.equal(courses.length,8);
 for(const course of courses)assert.ok(getPublicPage(course.path)?.body);
 for(const page of publicPages){assert.ok(page.title);for(const img of [...page.images,pageImage(page)])if(img.startsWith('/'))assert.ok(existsSync('public'+img),img);for(const link of page.body.matchAll(/\[[^\]]*\]\((\/[^)]+)\)/g)){if(!link[1].startsWith('/legacy/'))assert.ok(getPublicPage(link[1].split('#')[0])||link[1]==='/',link[1]);}}
 assert.match(getPublicPage('/hakkimizda')!.body,/en fazla 8 kişilik/);
 assert.match(getPublicPage('/kadro/umran-aslan')!.body,/Dokuz Eylül/);
 assert.equal(getPublicPage('/admin'),null);assert.equal(getPublicPage('__proto__'),null);
});
test('page editing is backward compatible, scoped to real public pages and bounded',()=>{
 const {pageOverrides,...oldContent}=defaultContent;assert.deepEqual(resolveContent(oldContent).data?.pageOverrides,{});
 const original=getPublicPage('/hakkimizda')!;
 const edit={title:'Yeni kulüp başlığı',intro:'Açıklama',body:'## Kulübümüz\n\nYeni metin.',image:pageImage(original)};
 assert.equal(contentSchema.safeParse({...defaultContent,pageOverrides:{'/hakkimizda':edit}}).success,true);
 assert.equal(resolvePage(original,edit).title,edit.title);assert.notEqual(original.title,edit.title);
 for(const path of ['/admin','/api/admin/content','__proto__'])assert.equal(contentSchema.safeParse({...defaultContent,pageOverrides:{[path]:edit}}).success,false);
 assert.equal(contentSchema.safeParse({...defaultContent,pageOverrides:{'/hakkimizda':{...edit,body:'x'.repeat(16001)}}}).success,false);
});
test('formatted public content permits normal links while rejecting executable protocols',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,x','//evil.example/x','/\\evil.example','https://user:pass@example.com/a']){assert.equal(publicHref(value),null);assert.equal(publicImage(value),null);}
 assert.equal(publicHref('/hakkimizda'),'/hakkimizda');assert.equal(publicHref('tel:+905459477973'),'tel:+905459477973');assert.ok(publicImage('/legacy/images/kadro/umran-aslan.webp'));
});
