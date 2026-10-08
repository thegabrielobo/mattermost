# PSWE07 Primer avance de Mattermost

La línea base es v11.8.0, commit `e8bd2b8a871cbeff6943bead62328478118188df`. Los archivos académicos documentan el análisis; no modifican la funcionalidad del sistema.

## Arquitectura de contexto

Abrir `arquitectura-contexto.drawio` en https://app.diagrams.net mediante Archivo > Abrir desde > Dispositivo. Contiene formas y relaciones editables. `arquitectura-contexto.mmd` ofrece la misma vista de contexto en Mermaid. Mattermost se representa como un solo sistema y se relaciona con administrador y usuario móvil; no se incluyen componentes internos.

## Código fuente y entorno de desarrollo

```sh
git clone https://github.com/thegabrielobo/mattermost.git
cd mattermost
git checkout v11.8.0
git rev-parse HEAD
```

Usar las versiones definidas por la etiqueta: Node 24 y Go 1.26.3 (revisar `.nvmrc`, `webapp/package.json` y `server/go.mod`). Preparar Docker y make. La guía oficial explica `make run-server` en `server/` y `make run` en `webapp/`:
https://docs.mattermost.com/developers/contribute/developer-setup

## Comprobación realizada el 8 de octubre de 2026

Se ejecutó la distribución oficial `mattermost/mattermost-team-edition:11.8.0` con PostgreSQL 16 en Docker. En este Mac ARM64 fue necesario `--platform linux/amd64`. El endpoint `/api/v4/system/ping` devolvió HTTP 200 y `status: OK`; la aplicación web respondió HTTP 200. Consultar `evidencia-base.json` para la versión y digest. Esta comprobación usa el binario oficial y no acredita compilación local del código fuente ni reproducción del defecto.

Entorno ya preparado en el equipo de Gabriel: `http://localhost:8065`. Para reanudar: `docker start pswe07-postgres pswe07-mattermost`. Para detener: `docker stop pswe07-mattermost pswe07-postgres`. Las credenciales de prueba permanecen fuera del repositorio.

## Selección pendiente de validación

El issue https://github.com/mattermost/mattermost/issues/38666 figura cerrado desde el 29 de septiembre, con razón `completed`. Antes de implementar se debe reproducir el defecto y validar con la docente si esta propuesta sigue siendo admisible; de no serlo, seleccionar otro issue no resuelto de UI web. No se ha implementado la corrección.

## Uso de IA

ChatGPT Codex apoyó la consolidación del avance, la consulta del estado del issue, la fijación de la base y la documentación de arquitectura y entorno. El equipo debe revisar el análisis y la propuesta técnica. No se incluyen secretos ni datos reales en estas evidencias.
