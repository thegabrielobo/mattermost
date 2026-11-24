# Validación de arquitectura y proceso — GH-04

**Fecha:** 23 de noviembre de 2026

**Rama:** `pswe07-final-documentacion`

**PR académico:** [thegabrielobo/mattermost#2](https://github.com/thegabrielobo/mattermost/pull/2)

## Resultado

Los seis pares Mermaid/SVG fueron comprobados. Las fuentes están presentes y no vacías; las representaciones son XML válido, contienen las entidades, relaciones, mensajes o etapas definidos en su fuente y fueron inspeccionadas visualmente desde el commit publicado. Las rutas relativas del README apuntan a archivos existentes.

| Vista | Fuente | SVG | Resultado |
|---|---|---|---|
| C4 nivel 1 — contexto | `architecture/c4_context.mmd` | `architecture/c4_context.svg` | Aprobado |
| C4 nivel 2 — contenedores | `architecture/c4_container.mmd` | `architecture/c4_container.svg` | Aprobado |
| Secuencia web #38666 | `architecture/issue_38666_sequence.mmd` | `architecture/issue_38666_sequence.svg` | Aprobado |
| Secuencia móvil #26673 | `architecture/issue_26673_sequence.mmd` | `architecture/issue_26673_sequence.svg` | Aprobado |
| Proceso observado | `process/process_as_is.mmd` | `process/process_as_is.svg` | Aprobado |
| Proceso propuesto | `process/process_to_be.mmd` | `process/process_to_be.svg` | Aprobado |

La revisión de correspondencia se realizó sobre el contenido semántico del SVG, no mediante igualdad binaria. Una regeneración puede cambiar identificadores, coordenadas o estilos sin alterar el diagrama.

## Enlaces

| Enlace | Resultado |
|---|---|
| Rutas locales a seis fuentes Mermaid | Aprobado |
| Rutas locales a seis SVG | Aprobado |
| Issue web `mattermost/mattermost#38666` | Accesible; cerrado upstream |
| Issue móvil `mattermost/mattermost#26673` | Accesible; abierto upstream |
| PR web académico `thegabrielobo/mattermost#1` | Accesible |
| PR móvil académico `thegabrielobo/mattermost-mobile#1` | Accesible |
| Ejecuciones de Actions enlazadas | Accesibles al corte |

Durante GH-04 se corrigió el enlace móvil que apuntaba a `mattermost/mattermost-mobile#26673`, ruta que devuelve 404. El reporte vigente está en `mattermost/mattermost#26673`.

## Controles del PR #2

Los resultados siguientes corresponden al commit `072199b0709ca096e7e182e40b8ed5ba4ad0ac9d`, cabeza inicial del PR:

| Control | Resultado | Interpretación |
|---|---|---|
| [Docs Gap Analysis](https://github.com/thegabrielobo/mattermost/actions/runs/45100818949) | Aprobado | Es el control automatizado más directamente relacionado con el alcance documental. |
| [API](https://github.com/thegabrielobo/mattermost/actions/runs/45100818911) | Aprobado | Confirma que su job terminó, pero no valida el contenido de Mermaid o SVG. |
| [Server CI](https://github.com/thegabrielobo/mattermost/actions/runs/45100819040) | Fallo de preparación | `Build Environment` falló en `Setup build environment` con `Username and password required`. Los jobs posteriores se omitieron. |
| E2E, CodeQL y análisis auxiliares omitidos | Omitidos | No aportan evidencia necesaria para un cambio limitado a `academic/final/`. |

El fallo de Server CI ocurrió antes de ejecutar pruebas de servidor. Como el PR no modifica código de producto, API, esquema, dependencias ni configuración de ejecución, este resultado debe registrarse como limitación de infraestructura del fork y no como fallo funcional del cambio documental.

## Comprobaciones reproducibles

Desde la raíz del repositorio:

```bash
test "$(find academic/final/architecture academic/final/process -name '*.mmd' -type f | wc -l | tr -d ' ')" = "6"
test "$(find academic/final/architecture academic/final/process -name '*.svg' -type f | wc -l | tr -d ' ')" = "6"

for source in academic/final/architecture/*.mmd academic/final/process/*.mmd; do
    test -s "$source"
done

for image in academic/final/architecture/*.svg academic/final/process/*.svg; do
    xmllint --noout "$image"
done

git diff --check
```

Para regenerar los SVG a partir de las fuentes, use los comandos documentados en [README.md](README.md). La regeneración requiere Node.js, npm y Mermaid CLI.

## Criterio de salida de GH-04

- Seis pares Mermaid/SVG revisados: **cumplido**.
- Rutas relativas del README verificadas: **cumplido**.
- Enlace del issue móvil corregido: **cumplido**.
- Fallo de Server CI clasificado y documentado: **cumplido**.
- Controles aplicables al cambio documental identificados: **cumplido**.
- PR preparado para revisión humana independiente en GH-05: **cumplido después de publicar este cambio**.
