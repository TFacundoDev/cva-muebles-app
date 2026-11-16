# CVA Muebles

Tienda de muebles de madera con catálogo, modelo 3D girable, realidad aumentada ("Ver en mi casa"), consulta por WhatsApp, galería de fotos de clientes y panel para el dueño.

- **Web:** Next.js 16 (App Router) + Tailwind 4 — `apps/web`
- **API:** NestJS 12 + Prisma 7 sobre PostgreSQL — `apps/api`
- **Compartido:** tipos y validaciones (Zod) que usan los dos — `packages/shared`

Todo en TypeScript, en un monorepo con pnpm.

## Arrancar en local

Hace falta Node 22.12 o más nuevo, pnpm 10 y Docker (solo para la base de datos).

```bash
pnpm bootstrap                                # instala, compila el paquete compartido y genera el cliente de Prisma
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d db                      # PostgreSQL en el puerto 5432
pnpm db:migrate                              # crea las tablas
pnpm db:seed                                 # 4 categorías, 10 muebles y 4 fotos de galería de ejemplo
pnpm dev                                     # web en http://localhost:3000 y API en http://localhost:3001
```

Así como viene, corre en **modo desarrollo**: el login no pide contraseña y los archivos se guardan en `apps/api/storage`. No hace falta cuenta de Supabase ni de Cloudflare para probar todo.

| Para ver | Entrá a | Con el email |
|---|---|---|
| La tienda | http://localhost:3000 | — |
| El panel del dueño | http://localhost:3000/admin | `dueno@cva.test` (el que figura en `OWNER_EMAILS`) |
| Subir una foto como cliente | http://localhost:3000/galeria/subir | cualquier otro |

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Web, API y paquete compartido, recargando al guardar |
| `pnpm build` | Compila todo para producción |
| `pnpm test` | Pruebas unitarias (26: compartido y API) |
| `pnpm typecheck` | Revisa los tipos de los tres paquetes |
| `pnpm db:migrate` | Aplica las migraciones pendientes |
| `pnpm db:seed` | Carga los datos de ejemplo (`-- --force` borra y recarga) |
| `node apps/api/scripts/smoke.mjs` | Prueba de punta a punta contra la API levantada en modo desarrollo |

## Arquitectura

Es una arquitectura **mixta**, en tres niveles. Cada uno resuelve un problema distinto:

1. **Módulos por tema** (`apps/api/src/modules`): `products`, `categories`, `gallery`, `models3d`, `media`, `users`, `auth` y `store`. Un módulo no lee las tablas de otro: le pide los datos a su service.
2. **Capas adentro de cada módulo:** controller → service → repository. El controller no sabe de la base; el service no sabe de HTTP; el repository es lo único que usa Prisma.
3. **Puertos y adaptadores solo en el borde con lo externo.** El service depende de una clase abstracta (el puerto) y el `.env` decide qué adaptador se enchufa:

| Puerto | Para qué | Adaptadores |
|---|---|---|
| `FileStorage` | Guardar fotos y modelos | Cloudflare R2, disco local |
| `TokenVerifier` | Validar el login | Supabase Auth, modo desarrollo |
| `ModelSource` | De dónde sale el modelo 3D | Archivo subido (propio, escaneo o a medida), IA desde fotos |
| `AiModelProvider` | Quién genera el modelo con IA | Meshy, apagado |

La base de datos no lleva puerto a propósito: no va a cambiar, y Prisma queda directo en los repositories.

Dependencias entre módulos, sin círculos: `gallery → products → categories, media, models3d → media`.

```
apps/
├── api/
│   ├── prisma/                 esquema, migraciones y datos de ejemplo
│   ├── scripts/smoke.mjs       prueba de punta a punta
│   └── src/
│       ├── modules/            un módulo por tema (controller, service, repository)
│       ├── infrastructure/     base de datos, almacenamiento, tareas programadas y aviso a la web
│       ├── common/             validación y formato de errores
│       └── config/             lectura y validación del .env
└── web/
    └── src/
        ├── app/(tienda)/       inicio, catálogo, ficha y galería
        ├── app/admin/          panel del dueño
        ├── components/         piezas de la interfaz (diseño "variante A")
        └── lib/                cliente de la API y sesión
packages/shared/                tipos, esquemas Zod y utilidades
```

### Cómo funcionan las partes menos obvias

- **Subida de archivos.** El navegador le pide a la API una URL firmada, sube el archivo directo al almacenamiento y después avisa. La API valida lo subido, convierte las fotos a WebP (eso también les quita los datos de ubicación) y las deja en su carpeta definitiva. Los archivos pesados nunca pasan por la API.
- **Modelos 3D.** Cualquier origen termina en un `.glb` que la API procesa en segundo plano: lo valida, lo apoya en el piso, lo escala al alto real del producto y lo comprime. El estado avanza de pendiente a procesando y termina en listo o error. Si un reemplazo falla, sigue publicado el modelo anterior.
- **Caché de la tienda.** Las páginas públicas quedan cacheadas 5 minutos. Cuando el dueño cambia algo, la API le avisa a la web (`/api/revalidate`) y la próxima visita ya ve el dato nuevo.
- **Galería.** Toda foto entra como pendiente y solo se publica si el dueño la aprueba. Hay un tope de 5 fotos pendientes por persona.
- **Roles.** Es dueño quien figura en `OWNER_EMAILS` de la API. El resto de las cuentas son clientes.

## Despliegue

Cuesta unos US$4 por mes (la API en Fly) más el dominio. El resto entra en planes gratis.

| Pieza | Dónde | Plan B |
|---|---|---|
| Web | Vercel | Netlify, mismo repo y mismo dominio |
| API (Docker) | Fly.io, 512 MB, siempre encendida | Render gratis, misma imagen |
| Base y login | Supabase Free | Supabase Pro |
| Fotos y modelos | Cloudflare R2 | otro adaptador de `FileStorage` |
| DNS | Cloudflare | — |

> El plan Hobby de Vercel es solo para uso no comercial. Se asume ese riesgo: por eso Netlify queda desplegado como respaldo.

### 1. Supabase (base y login)

1. Creá el proyecto. En **Connect** copiá dos cadenas de conexión: *Transaction pooler* (puerto 6543) para `DATABASE_URL` y *Session pooler* (puerto 5432) para `DIRECT_URL`.
2. En **Authentication → Providers** activá Google (pide crear credenciales OAuth en Google Cloud).
3. En **Authentication → URL Configuration** poné tu dominio como *Site URL* y agregá `https://tudominio.com.ar/**` a las *Redirect URLs* (y la URL de Netlify, para el plan B).
4. Anotá la URL del proyecto y la clave pública (*publishable* o *anon*).

### 2. Cloudflare R2 (archivos)

1. Creá un bucket (por ejemplo `cva-muebles`) y habilitale acceso público con un dominio propio (`archivos.tudominio.com.ar`). Esa URL es `R2_PUBLIC_URL`.
2. Creá un segundo bucket **sin** acceso público para los backups (`R2_BACKUP_BUCKET`).
3. Creá un token de API con permiso de lectura y escritura sobre los dos buckets.
4. En el bucket público, cargá esta política de CORS. Sin ella no funcionan ni las subidas ni el visor 3D:

```json
[
  {
    "AllowedOrigins": ["https://tudominio.com.ar"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

### 3. API en Fly

```bash
fly launch --no-deploy --copy-config        # usa fly.toml; elegí el nombre de la app
fly secrets set \
  PUBLIC_API_URL=https://api.tudominio.com.ar \
  DATABASE_URL="postgresql://...:6543/postgres" \
  DIRECT_URL="postgresql://...:5432/postgres" \
  CORS_ORIGINS=https://tudominio.com.ar \
  WEB_URLS=https://tudominio.com.ar \
  REVALIDATE_SECRET=<un texto largo al azar> \
  SUPABASE_URL=https://xxxx.supabase.co \
  OWNER_EMAILS=<el email de Google del dueño> \
  R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET=cva-muebles R2_PUBLIC_URL=https://archivos.tudominio.com.ar \
  R2_BACKUP_BUCKET=cva-muebles-backups
fly deploy
```

Al arrancar, el contenedor aplica solo las migraciones pendientes. Las tareas programadas corren acá (`RUN_JOBS=true`): un ping a la base cada 3 días, para que Supabase no pause el proyecto, y un backup semanal al bucket privado.

### 4. Web en Vercel

Importá el repositorio y elegí `apps/web` como *Root Directory* (los comandos ya están en `apps/web/vercel.json`). Variables:

```
NEXT_PUBLIC_API_URL=https://api.tudominio.com.ar
NEXT_PUBLIC_SITE_URL=https://tudominio.com.ar
NEXT_PUBLIC_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave pública>
REVALIDATE_SECRET=<el mismo de la API>
```

### 5. DNS en Cloudflare

Apuntá `tudominio.com.ar` a Vercel, `api.tudominio.com.ar` a Fly y `archivos.tudominio.com.ar` a R2. Usá el dominio propio desde el primer día: así el CORS y las URLs del login no cambian si un día mudás la web o la API.

### Plan B

- **Web en Netlify.** Importá el mismo repo (usa `netlify.toml`) con las mismas variables, sin apuntarle el dominio. Si Vercel falla o suspende la cuenta, cambiás el registro DNS a Netlify. Para que la API también le avise a Netlify, agregá su URL a `WEB_URLS` y a `CORS_ORIGINS`, separadas por coma.
- **API en Render.** `render.yaml` despliega la misma imagen con `RUN_JOBS=false`. Si Fly falla, cambiás el registro de `api.tudominio.com.ar`. La API no guarda estado propio, así que las dos pueden convivir.

## Antes de salir a producción

- [ ] Probar la etapa 0 del plan: escanear tres muebles reales y verlos en 3D y en AR desde un iPhone y un Android.
- [ ] Borrar los productos y las fotos de ejemplo desde el panel (o no correr `db:seed` contra la base real).
- [ ] Cargar WhatsApp, dirección, horarios y mapa en **Ajustes del local**.
- [ ] Confirmar que `AUTH_MODE=supabase` y `STORAGE_DRIVER=r2` en la API. Con `NODE_ENV=production` la API se niega a arrancar en modo `dev`.
- [ ] Pedir un backup manual desde Ajustes y verificar que aparece en el bucket privado.

## Qué está probado y qué no

Probado en esta entrega, sobre PostgreSQL 16 real y en modo desarrollo:

- 26 pruebas unitarias y la prueba de punta a punta de la API (`smoke.mjs`).
- Un recorrido con navegador automático: visor 3D, menú del celular, crear un producto con foto y modelo desde el panel, publicar, subir una foto como cliente, aprobarla y verla publicada.
- La compilación de producción de la web y de la API, y el arranque de la API instalada solo con dependencias de producción.

**No probado**, porque necesita cuentas o equipos que no estaban disponibles:

- El login real con Google en Supabase y la conexión a su base.
- Cloudflare R2 de verdad (el adaptador solo se probó generando URLs firmadas).
- La construcción de la imagen con `docker build` y los despliegues en Fly, Render, Vercel y Netlify.
- La realidad aumentada en un celular real.
- La generación con IA (Meshy): está escrita siguiendo su documentación, sin clave para probarla.
- La migración inicial se escribió a mano con el formato de Prisma y se aplicó con `psql`. Conviene correr `pnpm --filter @cva/api db:migrate:dev` una vez: si Prisma detecta alguna diferencia con el esquema, lo va a avisar.

## Notas

- Prisma está fijado en la versión 7.10: la 8 todavía es *release candidate*.
- El backup es una exportación de todas las tablas a JSON comprimido, no un `pg_dump`. Alcanza para recuperar los datos; no incluye los archivos de R2.
- Si cambiás las medidas de un producto, volvé a subir su modelo: la escala se calcula al procesarlo.
- Al borrar un producto, las fotos de clientes de ese mueble quedan en la galería, sin el link.
- La pantalla de usuarios es de solo lectura.
