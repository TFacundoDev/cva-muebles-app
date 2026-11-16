// Prueba de humo: recorre los flujos principales contra una API levantada
// en modo desarrollo (AUTH_MODE=dev, STORAGE_DRIVER=local).
// Uso: node scripts/smoke.mjs [http://localhost:3001] [email-del-dueño]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

const API = process.argv[2] ?? 'http://localhost:3001';
const OWNER_EMAIL = process.argv[3] ?? 'dueno@cva.test';
const token = (email, name) =>
  `dev.${Buffer.from(JSON.stringify({ email, name })).toString('base64url')}`;
const OWNER = token(OWNER_EMAIL, 'Dueño Prueba');
const CUSTOMER = token('cliente.smoke@cva.test', 'Clienta Smoke');
const OTHER = token('otro.smoke@cva.test', 'Otro Smoke');

async function call(method, path, { auth, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function upload(ticket, data) {
  const res = await fetch(ticket.uploadUrl, { method: ticket.method, headers: ticket.headers, body: data });
  assert.equal(res.ok, true, `subida falló: ${res.status}`);
}

let step = 0;
const ok = (label) => console.log(`${String(++step).padStart(2, ' ')}. ✓ ${label}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const jpeg = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#8a4a28' } })
  .jpeg()
  .toBuffer();
const glb = await readFile(new URL('../prisma/seed-assets/sillon.glb', import.meta.url));

// --- Acceso ---
assert.equal((await call('GET', '/health')).data.database, true);
assert.equal((await call('GET', '/me')).status, 401);
assert.equal((await call('GET', '/me', { auth: OWNER })).data.role, 'owner');
assert.equal((await call('GET', '/me', { auth: CUSTOMER })).data.role, 'customer');
assert.equal((await call('GET', '/admin/products', { auth: CUSTOMER })).status, 403);
assert.equal((await call('GET', '/admin/products')).status, 401);
ok('login: sin token 401, cliente 403 en el panel, dueño entra');

// --- Categoría y producto ---
const stamp = Date.now();
const cat = await call('POST', '/admin/categories', { auth: OWNER, body: { name: `Prueba ${stamp}` } });
assert.equal(cat.status, 201);
const bad = await call('POST', '/admin/products', { auth: OWNER, body: { name: '' } });
assert.equal(bad.status, 400);
assert.ok(bad.data.details.length >= 1);
const created = await call('POST', '/admin/products', {
  auth: OWNER,
  body: { categoryId: cat.data.id, name: `Sillón de prueba ${stamp}`, widthCm: 65, depthCm: 66, heightCm: 78, woods: ['Algarrobo'] },
});
assert.equal(created.status, 201);
const product = created.data;
assert.equal(product.status, 'draft');
assert.equal((await call('GET', `/products/${product.slug}`)).status, 404);
ok('categoría y producto creados; el borrador no se ve en público; validación devuelve 400 con detalle');

// --- Fotos ---
const imgTicket = await call('POST', `/admin/products/${product.id}/images/upload-url`, {
  auth: OWNER, body: { contentType: 'image/jpeg', sizeBytes: jpeg.length },
});
assert.equal(imgTicket.status, 201);
await upload(imgTicket.data, jpeg);
const image = await call('POST', `/admin/products/${product.id}/images`, { auth: OWNER, body: { key: imgTicket.data.key } });
assert.equal(image.status, 201);
const imgRes = await fetch(image.data.url);
assert.equal(imgRes.status, 200);
const meta = await sharp(Buffer.from(await imgRes.arrayBuffer())).metadata();
assert.equal(meta.format, 'webp');
const tooBig = await call('POST', `/admin/products/${product.id}/images/upload-url`, {
  auth: OWNER, body: { contentType: 'image/jpeg', sizeBytes: 50 * 1024 * 1024 },
});
assert.equal(tooBig.status, 400);
const notImage = await call('POST', `/admin/products/${product.id}/images/upload-url`, {
  auth: OWNER, body: { contentType: 'application/pdf', sizeBytes: 1000 },
});
assert.equal(notImage.status, 400);
ok(`foto subida con URL firmada y convertida a WebP (${meta.width}×${meta.height}); rechaza tipo y tamaño inválidos`);

// --- Modelo 3D ---
async function waitModel() {
  for (let i = 0; i < 120; i++) {
    const s = await call('GET', `/admin/products/${product.id}/model`, { auth: OWNER });
    if (s.data.status === 'ready' || s.data.status === 'error') return s.data;
    await sleep(500);
  }
  throw new Error('el modelo no terminó de procesarse');
}
const modelTicket = await call('POST', `/admin/products/${product.id}/model/upload-url`, {
  auth: OWNER, body: { contentType: 'model/gltf-binary', sizeBytes: glb.length },
});
await upload(modelTicket.data, glb);
const started = await call('POST', `/admin/products/${product.id}/model`, {
  auth: OWNER, body: { source: 'upload', key: modelTicket.data.key },
});
assert.equal(started.status, 201);
const ready = await waitModel();
assert.equal(ready.status, 'ready', ready.error);
const glbRes = await fetch(ready.glbUrl);
assert.equal(glbRes.status, 200);
assert.equal(Buffer.from(await glbRes.arrayBuffer()).toString('latin1', 0, 4), 'glTF');
ok(`modelo .glb procesado en segundo plano (${glb.length} → ${ready.sizeBytes} bytes)${ready.warning ? ' · aviso: ' + ready.warning : ''}`);

// Un archivo roto no debe voltear el modelo que ya estaba publicado.
const brokenTicket = await call('POST', `/admin/products/${product.id}/model/upload-url`, {
  auth: OWNER, body: { contentType: 'model/gltf-binary', sizeBytes: 40 },
});
await upload(brokenTicket.data, Buffer.from('esto no es un modelo 3D, es texto plano'));
await call('POST', `/admin/products/${product.id}/model`, { auth: OWNER, body: { source: 'scan', key: brokenTicket.data.key } });
const failed = await waitModel();
assert.equal(failed.status, 'error');
assert.equal(failed.glbUrl, ready.glbUrl);
ok(`archivo inválido → error claro ("${failed.error}") y el modelo anterior sigue publicado`);

// Portada del modelo
const posterTicket = await call('POST', `/admin/products/${product.id}/model/upload-url`, {
  auth: OWNER, body: { kind: 'image', contentType: 'image/jpeg', sizeBytes: jpeg.length },
});
await upload(posterTicket.data, jpeg);
const poster = await call('POST', `/admin/products/${product.id}/model/poster`, { auth: OWNER, body: { key: posterTicket.data.key } });
assert.equal(poster.status, 201);
assert.ok(poster.data.posterUrl);
ok('portada del modelo guardada');

// --- Publicar ---
const published = await call('PATCH', `/admin/products/${product.id}`, { auth: OWNER, body: { status: 'published', featured: true } });
assert.equal(published.status, 200);
const pub = await call('GET', `/products/${product.slug}`);
assert.equal(pub.status, 200);
assert.equal(pub.data.has3d, true);
assert.equal(pub.data.images.length, 1);
const with3d = await call('GET', '/products?with3d=true&pageSize=60');
assert.ok(with3d.data.items.some((p) => p.id === product.id));
const byCat = await call('GET', `/products?category=${cat.data.slug}`);
assert.equal(byCat.data.total, 1);
ok('producto publicado: aparece en la ficha pública, en el filtro 3D y en su categoría');

// --- Galería ---
const gTicket = await call('POST', '/gallery/upload-url', { auth: CUSTOMER, body: { contentType: 'image/jpeg', sizeBytes: jpeg.length } });
assert.equal(gTicket.status, 201);
await upload(gTicket.data, jpeg);
const stolen = await call('POST', '/gallery', { auth: OTHER, body: { key: gTicket.data.key, productId: product.id, consent: true } });
assert.equal(stolen.status, 403);
const noConsent = await call('POST', '/gallery', { auth: CUSTOMER, body: { key: gTicket.data.key, productId: product.id, consent: false } });
assert.equal(noConsent.status, 400);
const post = await call('POST', '/gallery', { auth: CUSTOMER, body: { key: gTicket.data.key, productId: product.id, caption: 'Quedó hermoso', consent: true } });
assert.equal(post.status, 201);
assert.equal(post.data.status, 'pending');
assert.equal(post.data.authorName, 'Clienta');
let publicGallery = await call('GET', `/gallery?productId=${product.id}`);
assert.equal(publicGallery.data.total, 0);
assert.equal((await call('GET', '/admin/gallery', { auth: CUSTOMER })).status, 403);
const pendingList = await call('GET', '/admin/gallery?status=pending', { auth: OWNER });
assert.ok(pendingList.data.items.some((p) => p.id === post.data.id && p.authorEmail === 'cliente.smoke@cva.test'));
assert.equal((await call('PATCH', `/admin/gallery/${post.data.id}`, { auth: OWNER, body: { status: 'approved' } })).status, 204);
publicGallery = await call('GET', `/gallery?productId=${product.id}`);
assert.equal(publicGallery.data.total, 1);
assert.equal(publicGallery.data.items[0].product.slug, product.slug);
assert.equal((await call('GET', '/gallery/mine', { auth: CUSTOMER })).data[0].status, 'approved');
ok('galería: la foto entra pendiente, no se ve hasta que el dueño la aprueba; exige consentimiento y no deja usar archivos ajenos');

// --- Ajustes, usuarios y backup ---
const before = (await call('GET', '/settings/public')).data;
const set = await call('PATCH', '/admin/settings', { auth: OWNER, body: { hours: 'Lunes a sábado de 9 a 13' } });
assert.equal(set.data.hours, 'Lunes a sábado de 9 a 13');
assert.equal((await call('PATCH', '/admin/settings', { auth: OWNER, body: { whatsappNumber: '+54 379' } })).status, 400);
await call('PATCH', '/admin/settings', { auth: OWNER, body: { hours: before.hours } });
const users = await call('GET', '/admin/users', { auth: OWNER });
assert.ok(users.data.some((u) => u.email === 'cliente.smoke@cva.test' && u.galleryPosts === 1));
const backup = await call('POST', '/admin/backup', { auth: OWNER });
assert.equal(backup.status, 200);
assert.match(backup.data.file, /^backups\/cva-.*\.json\.gz$/);
ok(`ajustes del local, lista de usuarios y backup manual (${backup.data.file})`);

// --- Limpieza ---
assert.equal((await call('DELETE', `/admin/categories/${cat.data.id}`, { auth: OWNER })).status, 409);
assert.equal((await call('DELETE', `/admin/gallery/${post.data.id}`, { auth: OWNER })).status, 204);
assert.equal((await call('DELETE', `/admin/products/${product.id}`, { auth: OWNER })).status, 204);
assert.equal((await fetch(ready.glbUrl)).status, 404);
assert.equal((await fetch(image.data.url)).status, 404);
assert.equal((await call('DELETE', `/admin/categories/${cat.data.id}`, { auth: OWNER })).status, 204);
ok('no deja borrar una categoría con productos; al borrar el producto se borran sus archivos');

console.log('\nTodo bien.');
