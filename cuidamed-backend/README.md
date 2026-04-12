# Cuidamed — Backend API

API REST para el sistema de dispensación inteligente de medicamentos Cuidamed + BMO.

## Stack
- **Node.js + Express** — servidor HTTP y rutas
- **PostgreSQL** — base de datos relacional
- **JWT** — autenticación por roles
- **node-cron** — tareas programadas (alertas, recordatorios)

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# → Editar .env con tus credenciales de PostgreSQL

# 3. Crear la base de datos en PostgreSQL
createdb cuidamed

# 4. Ejecutar migraciones
npm run db:migrate

# 5. Iniciar en desarrollo
npm run dev

# 6. Iniciar en producción
npm start
```

## Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario (paciente o cuidador) |
| POST | `/api/auth/login` | Iniciar sesión → devuelve JWT |
| GET | `/api/auth/me` | Perfil del usuario autenticado |

### Medicamentos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/medications` | Listar medicamentos del paciente |
| POST | `/api/medications` | Registrar nuevo medicamento |
| PUT | `/api/medications/:id` | Editar medicamento |
| DELETE | `/api/medications/:id` | Desactivar medicamento |

### Dosis
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/doses/today` | Dosis del día actual |
| GET | `/api/doses/history?days=7` | Historial agrupado por fecha |
| GET | `/api/doses/adherence?days=7` | Porcentaje de adherencia + racha |
| POST | `/api/doses/:id/take` | Marcar dosis como tomada |
| POST | `/api/doses/generate` | Generar dosis del día (scheduler) |

### BMO (Dispositivo físico)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/bmo` | Estado del BMO + compartimentos |
| POST | `/api/bmo/register` | Registrar nuevo dispositivo |
| PATCH | `/api/bmo/compartment/:id` | Actualizar stock de un compartimento |
| PATCH | `/api/bmo/heartbeat` | Reporte de conexión del BMO |

### Notificaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/notifications` | Listar notificaciones del usuario |
| PATCH | `/api/notifications/:id/read` | Marcar como leída |
| PATCH | `/api/notifications/read-all` | Marcar todas como leídas |

### Cuidador
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/caregiver/patients` | Lista de pacientes vinculados |
| POST | `/api/caregiver/link` | Vincular con paciente (por email) |
| DELETE | `/api/caregiver/link/:patient_id` | Desvincular paciente |

## Autenticación

Todos los endpoints (excepto `/auth/register` y `/auth/login`) requieren:
```
Authorization: Bearer <token>
```

## Tareas automáticas (Scheduler)

| Cuándo | Tarea |
|--------|-------|
| 00:01 todos los días | Genera las dosis del día para todos los medicamentos activos |
| Cada minuto | Envía recordatorio 30 min antes de cada dosis |
| Cada 5 minutos | Detecta dosis olvidadas (+45 min sin tomarse) → alerta a paciente y cuidador |
| Domingos 8 pm | Envía resumen semanal de adherencia a los cuidadores |

## Estructura de archivos

```
cuidamed-backend/
├── server.js               ← Entrada principal
├── .env.example            ← Variables de entorno
├── db/
│   ├── index.js            ← Conexión PostgreSQL
│   ├── schema.sql          ← Tablas y índices
│   └── migrate.js          ← Ejecutar schema
├── middleware/
│   └── auth.js             ← JWT + guardas de rol
├── routes/
│   ├── auth.js             ← Register, login, perfil
│   ├── medications.js      ← CRUD medicamentos
│   ├── doses.js            ← Dosis, historial, adherencia
│   ├── bmo.js              ← Estado BMO, compartimentos
│   ├── notifications.js    ← Notificaciones
│   └── caregiver.js        ← Panel cuidador
└── jobs/
    ├── scheduler.js        ← Cron jobs
    └── notifications.js    ← Helper crear notificaciones
```
