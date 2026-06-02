import { Pipe, PipeTransform } from '@angular/core';

/**
 * Pipe puro: formatea fechas en "hace X" relativo a ahora.
 * Acepta Date, ISO string o epoch ms. Si no se puede parsear devuelve ''.
 *
 * NOTA: es un pipe `pure: true`, asi que si el cliente quiere refresco
 * en vivo debe forzar change detection (signal/intervalo).
 */
@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: Date | string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    const date =
      value instanceof Date ? value :
      typeof value === 'number' ? new Date(value) :
      new Date(value);
    const t = date.getTime();
    if (Number.isNaN(t)) return '';

    const diffSec = Math.round((Date.now() - t) / 1000);
    const abs = Math.abs(diffSec);

    if (abs < 45)     return 'hace unos segundos';
    if (abs < 90)     return 'hace 1 min';
    if (abs < 3600)   return `hace ${Math.round(abs / 60)} min`;
    if (abs < 5400)   return 'hace 1 h';
    if (abs < 86400)  return `hace ${Math.round(abs / 3600)} h`;
    if (abs < 172800) return 'ayer';
    if (abs < 2592000) return `hace ${Math.round(abs / 86400)} d`;
    if (abs < 31536000) return `hace ${Math.round(abs / 2592000)} mes`;
    return `hace ${Math.round(abs / 31536000)} a`;
  }
}
