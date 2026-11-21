# ROBOKAN

Simulador educativo de robotica y electronica en el navegador.
Bloques con C++ equivalente + circuito 2D + mundo 3D con fisica.

Prueba del Rol 2: ejecutar `npm install` y `npm run dev`, y abrir `/blocks.html`. `npm test` ejecuta las pruebas y `npm run build` compila la página de bloques.

Ver docs/arquitectura.md y docs/contrato.md

## Desarrollo local

Instala con `npm ci --ignore-scripts` y ejecuta `npm run dev`. Desde la página principal, selecciona un proyecto y pulsa **Abrir circuito**. También puedes entrar en `/circuit.html` dentro del servidor local.

Comprobaciones: `npm run test:circuit`, `npm run typecheck:circuit`, `npm run format:check` y `npm run build`. La construcción conserva la página principal y genera el circuito como una entrada separada en `dist/`. El editor funciona con un catálogo de desarrollo; integración del runtime TypeScript, mundo 3D y el catálogo de producción siguen siendo integraciones de los otros roles.
