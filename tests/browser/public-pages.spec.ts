import {test,expect} from '@playwright/test';
test('public menus open full legacy pages, contact information and programme details',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 await page.getByRole('navigation',{name:'Ana menü'}).getByRole('link',{name:'Kulübümüz',exact:true}).click();await expect(page).toHaveURL(/\/hakkimizda$/);await expect(page.getByRole('heading',{level:1})).toContainText('Alanya’da suyla çalışan bir kulüp');await expect(page.locator('.public-rich-text')).toContainText('en fazla 8 kişilik');
 await page.getByRole('navigation',{name:'Ana menü'}).getByRole('link',{name:'İletişim',exact:true}).click();await expect(page).toHaveURL(/\/iletisim$/);await expect(page.getByRole('heading',{name:'Çalışma saatleri',exact:true})).toBeVisible();await expect(page.locator('.public-contact-grid')).toContainText('100. Yıl Recep Hacıfazlıoğlu');await expect(page.getByRole('link',{name:/Google Haritalar/})).toHaveAttribute('href',/^https:\/\/www.google.com\/maps/);await page.screenshot({path:'test-results/contact-desktop.png',fullPage:true});
 await page.goto('/programlar');await expect(page.locator('.public-course-card')).toHaveCount(8);await page.locator('.public-course-card a').first().click();await expect(page).toHaveURL(/\/programlar\/bilmiyor-3-5$/);await expect(page.locator('.public-rich-text')).not.toBeEmpty();
 await page.goto('/kadro');await page.getByRole('link',{name:'Başarıları ve detay',exact:true}).click();await expect(page).toHaveURL(/\/kadro\/umran-aslan$/);await expect(page.locator('.public-rich-text')).toContainText('Dokuz Eylül');
 await page.goto('/en/about');await expect(page.locator('.public-rich-text')).not.toBeEmpty();
});
test('full public pages fit mobile and desktop without anchor-only navigation or broken images',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.goto('/');await page.evaluate(()=>{const brand=document.querySelector('.site-brand strong');if(brand)brand.textContent='ALANYA DENİZ ASLANLARI';});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===390){await page.getByRole('button',{name:'Menü',exact:true}).click();await page.getByRole('navigation',{name:'Ana menü'}).getByRole('link',{name:'İletişim',exact:true}).click();await expect(page).toHaveURL(/\/iletisim$/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'test-results/contact-mobile.png',fullPage:true});await page.goto('/');}
  await page.locator('footer').scrollIntoViewIfNeeded();await page.evaluate(()=>{for(const img of document.images)img.loading='eager';});await page.waitForFunction(()=>[...document.images].every(img=>img.complete&&img.naturalWidth>0));await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.locator('a[href^="#"]:not(.skip-link)').count()).toBe(0);
  if(width===390||width===1440)await page.screenshot({path:`test-results/enriched-home-${width}.png`,fullPage:true});
 }
});
test('unknown public paths return 404 without redirecting visitors into a private panel',async({request})=>{
 const result=await request.get('/olmayan-kulup-sayfasi');expect(result.status()).toBe(404);
 const sitemap=await request.get('/sitemap.xml');expect(sitemap.status()).toBe(200);expect(await sitemap.text()).toContain('/hakkimizda');
});
test('club details reveal while scrolling and reduced motion keeps content visible',async({page})=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');
 const club=page.locator('.public-club-feature');await expect(club).toHaveClass(/reveal-pending/);await club.scrollIntoViewIfNeeded();await expect(club).not.toHaveClass(/reveal-pending/);await expect(club).toHaveCSS('opacity','1');
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.locator('.reveal-pending')).toHaveCount(0);await expect(page.locator('.club-photo-stamp')).toHaveCSS('animation-name','none');
});
