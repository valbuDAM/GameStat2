import { Injectable } from '@angular/core';

import { SupabaseService } from './supabase.service';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

@Injectable({ providedIn: 'root' })
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Sube una imagen al bucket "avatars" en la carpeta del usuario y devuelve
   * la URL publica (con cache-buster para forzar refresco en clientes).
   */
  async uploadAvatar(userId: string, file: File): Promise<string> {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error('Formato no soportado. Usa PNG, JPG, WEBP o GIF.');
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error('La imagen no puede superar 4 MB.');
    }

    const client = this.supabase.assertConfigured();
    const ext = this.extractExtension(file);
    const path = `${userId}/avatar.${ext}`;

    const { error } = await client.storage
      .from(AVATAR_BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: '3600'
      });

    if (error) {
      throw new Error(this.mapStorageError(error.message));
    }

    const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error('No se pudo obtener la URL del avatar.');
    }

    // Cache-buster para que el navegador descargue la nueva versión.
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  private extractExtension(file: File): string {
    const fromName = file.name.split('.').pop()?.toLowerCase();
    if (fromName && fromName.length <= 5) return fromName;
    if (file.type.includes('png')) return 'png';
    if (file.type.includes('webp')) return 'webp';
    if (file.type.includes('gif')) return 'gif';
    return 'jpg';
  }

  private mapStorageError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('row level security') || m.includes('not authorized')) {
      return 'No tienes permiso para subir el avatar. Asegurate de haber iniciado sesion.';
    }
    if (m.includes('bucket') && m.includes('not found')) {
      return 'El bucket "avatars" no existe. Crea el bucket en Supabase ejecutando supabase/storage_avatars.sql.';
    }
    return message;
  }
}
