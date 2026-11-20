# Arquitectura

Todo corre en el navegador. Sin backend en el MVP.

## Flujo
Bloques o Python -> Runtime (Python, Skulpt) -> Circuito 2D -> Mundo 3D

## Regla de oro
El robot es UN solo objeto (RobotDefinition en core).
El circuito 2D y el mundo 3D son dos vistas del mismo objeto.
Nadie guarda su propia copia.

## Reglas de modulos
- Cada modulo expone solo lo que sale de su index.ts
- Nadie importa archivos internos de otro modulo
- Los bloques generan Python; solo hay un motor de ejecucion
