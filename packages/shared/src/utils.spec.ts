import { describe, expect, it } from 'vitest';
import { buildWhatsAppLink, formatDimensions, formatPrice, slugify } from './utils.js';
import { galleryCreateSchema, registerModelSchema } from './schemas.js';

describe('slugify', () => {
  it('saca tildes, eñes y símbolos', () => {
    expect(slugify('Sillón Algarrobo')).toBe('sillon-algarrobo');
    expect(slugify('  Cómoda Petiribí (6 cajones) ')).toBe('comoda-petiribi-6-cajones');
    expect(slugify('Mesa de luz ñandú')).toBe('mesa-de-luz-nandu');
  });
});

describe('buildWhatsAppLink', () => {
  const template = 'Hola, me interesa {producto} ({link}). ¿Está disponible?';

  it('arma el link con el mensaje codificado', () => {
    const link = buildWhatsAppLink('+54 9 379 412-3456', template, {
      producto: 'el Sillón Algarrobo',
      link: 'https://cva.com.ar/muebles/living/sillon-algarrobo',
    });
    expect(link).toMatch(/^https:\/\/wa\.me\/5493794123456\?text=/);
    expect(decodeURIComponent(link!.split('text=')[1])).toBe(
      'Hola, me interesa el Sillón Algarrobo (https://cva.com.ar/muebles/living/sillon-algarrobo). ¿Está disponible?',
    );
  });

  it('no deja paréntesis vacíos cuando no hay link', () => {
    const link = buildWhatsAppLink('5493794123456', template, { producto: 'un mueble' });
    expect(decodeURIComponent(link!.split('text=')[1])).toBe(
      'Hola, me interesa un mueble. ¿Está disponible?',
    );
  });

  it('devuelve null si no hay número cargado', () => {
    expect(buildWhatsAppLink('', template)).toBeNull();
  });
});

describe('formatos', () => {
  it('medidas', () => {
    expect(formatDimensions(65, 66, 78)).toBe('65 × 66 × 78 cm');
    expect(formatDimensions(null, null, null)).toBeNull();
  });
  it('precio opcional', () => {
    expect(formatPrice(null)).toBe('Consultar precio');
    expect(formatPrice(250000)).toContain('250.000');
  });
});

describe('esquemas', () => {
  it('la galería exige aceptar la publicación', () => {
    const base = { key: 'uploads/u1/a.jpg', productId: 'p1', caption: '' };
    expect(galleryCreateSchema.safeParse({ ...base, consent: true }).success).toBe(true);
    expect(galleryCreateSchema.safeParse({ ...base, consent: false }).success).toBe(false);
  });
  it('rechaza claves de archivo con ..', () => {
    const r = galleryCreateSchema.safeParse({
      key: 'uploads/../secret',
      productId: 'p1',
      consent: true,
    });
    expect(r.success).toBe(false);
  });
  it('el modelo pide archivo o fotos según el origen', () => {
    expect(registerModelSchema.safeParse({ source: 'upload' }).success).toBe(false);
    expect(registerModelSchema.safeParse({ source: 'upload', key: 'uploads/u/a.glb' }).success).toBe(true);
    expect(registerModelSchema.safeParse({ source: 'ai', key: 'uploads/u/a.glb' }).success).toBe(false);
    expect(registerModelSchema.safeParse({ source: 'ai', imageKeys: ['uploads/u/a.jpg'] }).success).toBe(true);
  });
});
