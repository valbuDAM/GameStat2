# Presupuesto — GAMESTAT

## 1. Coste de desarrollo (horas × tarifa)

Tarifa de referencia: **30 €/h** (becario junior / TFG colaborativo).

| Bloque | Horas | Importe |
| --- | ---: | ---: |
| 1 — Acceso a datos (Supabase + Postgres) | 45 | 1 350 € |
| 2 — Interfaces (Ionic + Angular) | 70 | 2 100 € |
| 3 — Sociales y reseñas | 50 | 1 500 € |
| 4 — Servicios (chat + offline) | 60 | 1 800 € |
| 5 — Seguridad + CI/CD + tests | 40 | 1 200 € |
| 6 — Multimedia / Android | 25 | 750 € |
| 7 — Documentación y memoria | 20 | 600 € |
| **Total desarrollo** | **310** | **9 300 €** |

## 2. Costes recurrentes (infraestructura)

| Concepto | Plan | Coste / mes |
| --- | --- | ---: |
| Supabase | Free (≤ 500 MB DB, 50 k MAU) | 0 € |
| Vercel | Hobby | 0 € |
| RAWG API | Free (≤ 20 k req/mes) | 0 € |
| Dominio `.dev` (opcional) | Cloudflare Registrar | ~12 €/año |
| Google Play (publicación) | Cuenta dev, **pago único** | 25 € |
| GitHub | Free para repos privados | 0 € |

**Total operativo mes 1**: ≈ 0 € + 25 € one-shot Play Store.
**Total operativo año 1**: ≈ 12 € (dominio) + 25 € (Play) = **37 €**.

## 3. Costes futuros si la app crece

| Umbral | Plan a contratar | Coste / mes aprox. |
| --- | --- | ---: |
| > 500 MB DB / > 50 k MAU | Supabase Pro | 25 $ |
| > 100 GB bandwidth | Vercel Pro | 20 $ |
| > 20 k req/mes a RAWG | Plan API extendido | bajo demanda |

## 4. Coste total estimado del TFG

- Desarrollo: **9 300 €** (valoración del esfuerzo, no facturado).
- Infraestructura primer año: **37 €** reales.
- Total cara al cliente / sponsor: **≈ 9 340 €**.

> Nota: en un entorno académico, el desarrollo no se factura, pero el cálculo de horas × tarifa estándar sirve para justificar el alcance frente al tribunal.
