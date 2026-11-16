# Tibia Dungeons

Auto dungeon web con Angular 21 y API Node. El Citizen, el Rat y los iconos se cargan desde `public/assets/tibia-local/`.

## Ejecutar

```bash
npm start
```

Abre `http://localhost:4300/` en el navegador. Usa Node.js 22.12 o posterior de la rama 22.

`npm start` levanta Angular en `http://localhost:4300/` y la API Node en `http://localhost:3001/`; Angular reenvía las llamadas `/api` a la API local. Para usar Neon localmente, copia `.env.example` a `.env.local`, reemplaza `DATABASE_URL` con la URL nueva de Neon y vuelve a iniciar. Sin esa variable, las partidas se guardan en `server/local-saves.json`.

En Render, configura `DATABASE_URL` como variable secreta del servicio. El servidor crea el esquema y la tabla al iniciar.

Los sprites se cargan desde `public/assets/tibia-local/`.
