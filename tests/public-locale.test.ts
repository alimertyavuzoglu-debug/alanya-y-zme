import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {locales,routeInfo,localizedPath} from '../src/lib/public-locale';
import {publicPages,getPublicPage} from '../src/lib/public-pages';
import {translator,localizeContent} from '../src/lib/public-i18n';
import {defaultContent,contentSchema} from '../src/lib/site-content';
import ui from '../src/data/public-ui-translations.json';
test('each public page has a corresponding page in all three languages',()=>{
 const canonical=publicPages.filter(p=>p.language==='tr');assert.equal(canonical.length,24);
 for(const page of canonical)for(const locale of locales){const path=localizedPath(page.path,locale);assert.equal(routeInfo(path).canonical,page.path);assert.equal(routeInfo(path).locale,locale);const translated=getPublicPage(path);assert.ok(translated,path);assert.equal(translated.language,locale);assert.ok(translated.title);if(page.body)assert.ok(translated.body);}
 for(const locale of locales){const path=localizedPath('/',locale);assert.equal(routeInfo(path).canonical,'/');assert.equal(routeInfo(path).locale,locale);}
 assert.equal(localizedPath('/ru/coaches/umran-aslan','en'),'/en/coaches/umran-aslan');assert.equal(localizedPath('https://example.org/','ru'),'https://example.org/');assert.equal(localizedPath('/admin','ru'),'/admin');
});
test('all static public labels including form errors have English and Russian text',()=>{
 for(const name of ['public-site','public-layout','public-subpage','public-header','public-rich-text','trial-application','public-federations']){
  const path=`src/components/${name}.tsx`,tree=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function walk(node:ts.Node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='t'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0])){const key=node.arguments[0].text;for(const locale of ['en','ru'] as const)assert.ok((ui[locale] as Record<string,string>)[key],`${locale}: ${key}`);}ts.forEachChild(node,walk);}walk(tree);
 }
 assert.equal(translator('ru')('Başvuruyu gönder'),'Отправить заявку');
});
test('translated CMS text can be edited independently while contact and images remain shared',()=>{
 const content={...defaultContent,localizedText:{en:{heroTitle:'Independent English title'},ru:{heroTitle:'Заголовок на русском'}}};
 assert.equal(contentSchema.safeParse(content).success,true);assert.equal(localizeContent(content,'tr').heroTitle,defaultContent.heroTitle);assert.equal(localizeContent(content,'en').heroTitle,'Independent English title');assert.equal(localizeContent(content,'ru').heroTitle,'Заголовок на русском');assert.equal(localizeContent(content,'ru').phone,defaultContent.phone);assert.equal(localizeContent(content,'en').heroImage,defaultContent.heroImage);
 assert.equal(contentSchema.safeParse({...content,localizedText:{en:{phone:'+12345'}}}).success,false);
});
test('programme translations keep sporting licence meaning and public schedules',()=>{
 for(const locale of ['en','ru'] as const){const page=getPublicPage(localizedPath('/programlar/triatlon-birebir',locale))!;assert.ok(!/undergraduate|высшего образования/i.test(page.intro));assert.match(page.body,/09:00–19:00/);const freestyle=getPublicPage(localizedPath('/programlar/biliyor-6-9',locale))!;assert.ok(!/free development|бесплат/i.test(freestyle.body));assert.match(freestyle.body,/16:00–17:00/);}
});
