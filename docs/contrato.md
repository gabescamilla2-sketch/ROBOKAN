# Contrato entre modulos

Acordar en la primera hora. Los tipos viven en src/core.

## 1. Ficha de componente
id, nombre, voltaje, modelo 3D, svg 2D, pines (nombre, tipo, posicion 2D), puntos de montaje 3D, comportamiento.

## 2. Definicion del robot (fuente unica)
chasis, piezas montadas (y en que punto), placa, cables (pin a pin), programa.

## 3. API de hardware (lo que el codigo Python puede llamar)
digital_read, digital_write, analog_read, pwm_write, sleep, distancia, servo.

## 4. Consultas al mundo
distancia por rayo, intensidad de flama, concentracion de gas, color bajo sensor IR.

## 5. Eventos
pin cambiado, componente quemado, mision completada, error de conexion.
