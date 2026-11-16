import { BadRequestException } from '@nestjs/common';
import { MAX_PENDING_GALLERY_POSTS, type MeDto } from '@cva/shared';
import { GalleryService } from './gallery.service.js';

// Las capas se prueban solas: al service se le pasan dobles de su repository
// y de los services de otros módulos.
function setup(overrides: { published?: boolean; pending?: number } = {}) {
  const repository = {
    count: vi.fn().mockResolvedValue(overrides.pending ?? 0),
    create: vi.fn().mockImplementation(async (data) => ({
      id: 'post-1',
      ...data,
      status: 'pending',
      createdAt: new Date('2026-11-15T12:00:00Z'),
      moderatedAt: null,
    })),
    findById: vi.fn().mockResolvedValue({ id: 'post-1', imagePath: 'gallery/a.webp' }),
    setStatus: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const media = {
    ingestImage: vi.fn().mockResolvedValue('gallery/a.webp'),
    url: (key: string) => `https://cdn.test/${key}`,
    removeFile: vi.fn().mockResolvedValue(undefined),
  };
  const products = {
    isPublished: vi.fn().mockResolvedValue(overrides.published ?? true),
    refs: vi
      .fn()
      .mockResolvedValue(new Map([['p1', { id: 'p1', name: 'Sillón', slug: 'sillon', categorySlug: 'living' }]])),
  };
  const users = {
    findByIds: vi.fn().mockResolvedValue(new Map([['u1', { displayName: 'María Gómez', email: 'm@test' }]])),
  };
  const webCache = { revalidate: vi.fn() };
  const service = new GalleryService(
    repository as never,
    media as never,
    products as never,
    users as never,
    webCache as never,
  );
  return { service, repository, media, webCache };
}

const user: MeDto = { id: 'u1', email: 'm@test', displayName: 'María Gómez', role: 'customer' };
const input = { key: 'uploads/u1/foto.jpg', productId: 'p1', caption: '', consent: true as const };

describe('GalleryService', () => {
  it('una foto nueva queda pendiente y muestra solo el primer nombre', async () => {
    const { service, webCache } = setup();
    const post = await service.create(user, input);
    expect(post.status).toBe('pending');
    expect(post.authorName).toBe('María');
    expect(post.imageUrl).toBe('https://cdn.test/gallery/a.webp');
    // Todavía no hay nada público que regenerar.
    expect(webCache.revalidate).not.toHaveBeenCalled();
  });

  it('no acepta fotos de un mueble que no está publicado', async () => {
    const { service, media } = setup({ published: false });
    await expect(service.create(user, input)).rejects.toThrow(BadRequestException);
    expect(media.ingestImage).not.toHaveBeenCalled();
  });

  it('frena el spam: hay un tope de fotos pendientes por persona', async () => {
    const { service, media } = setup({ pending: MAX_PENDING_GALLERY_POSTS });
    await expect(service.create(user, input)).rejects.toThrow(/esperando revisión/);
    expect(media.ingestImage).not.toHaveBeenCalled();
  });

  it('al aprobar le avisa a la web que regenere la galería', async () => {
    const { service, repository, webCache } = setup();
    await service.moderate('post-1', { status: 'approved' });
    expect(repository.setStatus).toHaveBeenCalledWith('post-1', 'approved');
    expect(webCache.revalidate).toHaveBeenCalledWith('gallery');
  });

  it('al borrar una foto también borra el archivo', async () => {
    const { service, media } = setup();
    await service.delete('post-1');
    expect(media.removeFile).toHaveBeenCalledWith('gallery/a.webp');
  });
});
