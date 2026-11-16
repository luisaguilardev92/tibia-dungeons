# Tibia Dungeons

Auto dungeon web con Angular 21 y API Node. El Citizen, el Rat y los iconos se cargan desde `public/assets/tibia-local/`.

## Ejecutar

```bash
npm start
```

Abre `http://localhost:4300/` en el navegador. Usa Node.js 22.12 o posterior de la rama 22.

`npm run start:server` inicia la API Node en `http://localhost:3001/`. Angular reenvía `/api` a esa API durante el desarrollo. Sin `DATABASE_URL`, las partidas se guardan localmente en `server/local-saves.json`; en Render, configura `DATABASE_URL` con la conexión de Neon.

Los sprites originales del cliente de Tibia no se incluyen en este repositorio público. El proyecto los carga desde `public/assets/tibia-local/` cuando están disponibles localmente.
