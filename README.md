# ROBOKAN

Simulador educativo de robotica y electronica en el navegador.
Bloques con C++ equivalente + circuito 2D + mundo 3D con fisica.

Prueba del Rol 2: ejecutar `npm install` y `npm run dev`, y abrir `/blocks.html`. `npm test` ejecuta las pruebas y `npm run build` compila la página de bloques.

Ver docs/arquitectura.md y docs/contrato.md

## Mundo 3D

Ejecuta `npm install` y `npm run dev`. Abre `/blocks.html?example=motors&world=1` para probar un programa con dos motores y un ultrasónico en la escena local de Babylon.js. Pulsa Ejecutar, Pausar, Reanudar o Detener. Reiniciar robot devuelve su posición inicial.

El ejemplo avanza, mide distancia, gira y retrocede. Los bloques y el mundo aparecen lado a lado; las pestañas permiten revisar C++ e instrucciones conservando la simulación. Puedes elegir cámara orbital, superior o de seguimiento, mostrar el rayo ultrasónico y la trayectoria, y consultar velocidades y orientación en vivo. Desmarca **Repetir programa** para una sola ejecución con apagado automático al terminar. Al cambiar de pestaña del navegador, el programa se pausa y debes reanudarlo al volver.

Desde `/circuits.html`, Mundo 3D abre el robot con los componentes y conexiones actuales. El ultrasónico mide obstáculos del entorno por rayos. Los motores requieren alimentación y sus identificadores se muestran en la pantalla de programación. El catálogo es educativo y el movimiento usa cinemática diferencial con colisiones simplificadas.

## Desarrollo local

Instala con `npm ci --ignore-scripts` y ejecuta `npm run dev`. Desde la página principal, selecciona un proyecto y pulsa **Abrir circuito**. También puedes entrar en `/circuit.html` dentro del servidor local.

Comprobaciones: `npm test`, `npm run typecheck:circuit`, `npm run format:check` y `npm run build`. La construcción conserva la página principal y genera el circuito y los bloques como entradas separadas en `dist/`. El runtime y el mundo 3D están conectados al circuito mediante el adaptador público. El catálogo sigue siendo de desarrollo y el montaje de modelos definitivos corresponde a la integración del Rol 5.
