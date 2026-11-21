# RoboLab

Simulador educativo de robotica y electronica en el navegador.
Bloques o Python + circuito 2D tipo Tinkercad + mundo 3D con fisica.

Ver docs/arquitectura.md y docs/contrato.md

## Desarrollo local

Instala con `npm ci --ignore-scripts` y ejecuta `npm run dev`. Desde la página principal, selecciona un proyecto y pulsa **Abrir circuito**. También puedes entrar en `/circuit.html` dentro del servidor local.

Comprobaciones: `npm run test:circuit`, `npm run typecheck:circuit`, `npm run format:check` y `npm run build`. La construcción conserva la página principal y genera el circuito como una entrada separada en `dist/`. El editor funciona con un catálogo de desarrollo; Python, mundo 3D y el catálogo de producción siguen siendo integraciones de los otros roles.
