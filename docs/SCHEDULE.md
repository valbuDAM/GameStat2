# Cronograma — GAMESTAT

## 1. Gantt

```mermaid
gantt
    title GAMESTAT — Planificación TFG
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Análisis
    Definición de alcance         :a1, 2026-01-12, 7d
    Modelo de datos preliminar    :a2, after a1, 5d
    Diseño UI low-fi              :a3, after a2, 5d

    section Backend
    Esquema Supabase + RLS        :b1, 2026-02-02, 7d
    RPCs + realtime               :b2, after b1, 5d
    Seed + pruebas SQL            :b3, after b2, 3d

    section Frontend
    Scaffold Angular + Ionic      :f1, 2026-02-09, 5d
    Auth + rutas + guardas        :f2, after f1, 5d
    Páginas core (feed, perfil)   :f3, after f2, 10d
    Chat realtime                 :f4, after f3, 10d
    Reseñas + estadísticas        :f5, after f4, 7d
    Refinamiento UI               :f6, after f5, 7d

    section Móvil / Multimedia
    Capacitor + plugins           :m1, 2026-04-06, 5d
    APK release + assets          :m2, after m1, 5d

    section Calidad
    Tests unitarios               :q1, 2026-04-20, 7d
    CI/CD                         :q2, after q1, 3d
    Auditoría seguridad           :q3, after q2, 3d

    section Documentación
    Manual + memoria              :d1, 2026-05-04, 14d
    Defensa + presentación        :d2, after d1, 5d
```

## 2. Hitos

| Hito | Fecha objetivo | Estado |
| --- | --- | --- |
| Esquema BBDD estable | Sem. 6 | Hecho |
| Auth + Feed funcional | Sem. 8 | Hecho |
| Chat en tiempo real | Sem. 11 | Hecho |
| Offline support | Sem. 13 | Hecho |
| APK release | Sem. 15 | En curso |
| Cobertura tests ≥ 70% | Sem. 17 | En curso |
| Memoria + defensa | Sem. 19 | Pendiente |

## 3. Horas estimadas vs reales (aprox.)

| Bloque | Estimadas | Reales |
| --- | --- | --- |
| 1 — Datos | 40 | 45 |
| 2 — UI | 60 | 70 |
| 3 — Sociales | 40 | 50 |
| 4 — Servicios / chat | 50 | 60 |
| 5 — Seguridad + CI/CD + tests | 35 | 40 |
| 6 — Capacitor / Android | 25 | 25 |
| 7 — Documentación | 25 | 20 |
| **Total** | **275** | **310** |

Desviación principal en bloque 4 (chat realtime + offline queue) por refactor a RPCs y depuración de la cola persistente.
