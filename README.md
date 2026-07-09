<<<<<<< HEAD
# cdnpage
=======
# Panel de Plugins - CDN & Admin

Plataforma privada y segura para administrar plugins, versiones JAR, configuraciones e imágenes usando **Netlify** (serverless + CDN) y **Cloudflare R2** (almacenamiento S3).

## Arquitectura

```
Frontend (Vue 3 SPA)  →  Netlify CDN
      ↓
Netlify Functions     →  Auth JWT + CRUD plugins/versiones
      ↓
Cloudflare R2         →  Archivos (JAR, imágenes, configs)
Netlify Blobs         →  Metadatos, usuarios, manifest
```

## Requisitos previos

- Cuenta en [Netlify](https://netlify.com)
- Cuenta en [Cloudflare R2](https://cloudflare.com/products/r2/) (o cualquier S3 compatible)
- API key de [Resend](https://resend.com) o [Postmark](https://postmarkapp.com) para emails

## Despliegue paso a paso

### 1. Clonar e instalar

```bash
git clone <repo> && cd cdn
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` para desarrollo local, y configúralas en Netlify:

| Variable | Descripción |
|---|---|
| `SESSION_SECRET` | Clave secreta JWT. Genera con `openssl rand -base64 48` |
| `PUBLIC_URL` | URL de tu sitio en Netlify (ej: `https://misplugins.netlify.app`) |
| `RESEND_API_KEY` o `POSTMARK_SERVER_TOKEN` | API key del proveedor de emails |
| `EMAIL_FROM` | Remitente de correos |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Credenciales R2 |
| `R2_BUCKET_PUBLIC` | Nombre del bucket público (imágenes, thumbnails) |
| `R2_BUCKET_PRIVATE` | Nombre del bucket privado (JAR, configs) |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_BASE_URL` | URL pública de tu bucket público (ej: `https://cdn.tudominio.com`) |
| `ADMIN_EMAIL` | Email del admin inicial |

### 3. Crear buckets en R2

```bash
# Crear buckets
aws s3api create-bucket --bucket cdn-public --endpoint-url $R2_ENDPOINT
aws s3api create-bucket --bucket cdn-private --endpoint-url $R2_ENDPOINT

# Configurar acceso público al bucket public (desde panel Cloudflare R2)
```

### 4. Desplegar en Netlify

Conectar repositorio o usar CLI:

```bash
npm run build
npx netlify deploy --prod
```

O enlazar tu repo a Netlify desde el panel: apunta `Build command` a `npm run build` y `Publish directory` a `dist`.

### 5. Primer acceso

- Ve a `https://tusitio.netlify.app/login`
- Ingresa el `ADMIN_EMAIL` configurado
- Recibirás un magic link en tu correo
- Haz clic y accedes al panel como administrador

## Desarrollo local

```bash
npm install
netlify dev
```

Esto levanta las funciones serverless y el frontend con hot-reload en `localhost:8888`.

## Funcionalidades del panel

- **Dashboard**: estadísticas de plugins y versiones
- **Plugins**: CRUD completo, subir JAR vía URLs firmadas, publicar/retirar
- **Versiones**: gestión de versiones, changelog, visibilidad, descargas
- **Usuarios** (admin): invitar, roles (admin/editor), bloquear
- **CDN**: generar URLs de descarga, reconstruir manifest público

## Seguridad

- JWT firmado con HS256 en cookie HttpOnly/Secure/SameSite
- CSRF con double-submit cookie (rotación por sesión)
- Rate limiting en login (5 intentos / 15 min por IP+email)
- Magic links de un solo uso con expiración de 15 minutos
- Roles jerárquicos: admin > editor > viewer
- No hay secretos en el frontend ni en el repositorio
- Headers de seguridad estrictos (CSP, HSTS, XFO, etc.)
- URLs firmadas (presigned URLs) para archivos privados con TTL configurable
- Archivos públicos vs privados segregados en buckets separados
>>>>>>> bee05a8 (Initial commit: panel admin plugins con Netlify + Cloudflare R2)
