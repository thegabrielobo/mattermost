# Cierre de controles técnicos del issue 38666

Revisión del 12 de noviembre de 2026 por Gabriel Lobo con apoyo de Codex.

## Resultado comprobado

La corrección de Sofía mantiene su lógica original: un guard adicional en onScroll y dos pruebas nuevas. Se repitieron independientemente los controles que su entorno Windows no había permitido cerrar.

- Con el componente base e8bd2b8a871cbeff6943bead62328478118188df y los tests de Sofía: 1 falla y 35 pasan.
- Con la corrección: 36 de 36 pruebas aprobadas.
- ESLint sin --fix sobre los dos archivos: salida 0, sin errores; una advertencia preexistente sobre any en la línea 40 del archivo de pruebas.
- Revisión completa de tipos: npm run check-types --workspace channels, salida 0, tras construir las dependencias compartidas.
- CI académico web aprobado: https://github.com/thegabrielobo/mattermost/actions/runs/43106817272.
- CI general Web App CI aprobado: https://github.com/thegabrielobo/mattermost/actions/runs/43106817307. Sus controles incluyen estilo, tipos, construcción, pruebas de Channels, Redux y plataforma, internacionalización, enlaces y cobertura.
- Los workflows API y YAML Lint del mismo commit también terminaron con éxito.

## Trazabilidad

PR: https://github.com/thegabrielobo/mattermost/pull/1

Base del PR: pswe07-base, 7b55634437df3d209ef3ed2d130af3259fc19f3f. La base ya fue corregida; no sigue apuntando a master.

Implementación de Sofía: 40c673451fe14a6914567d9cb9a8256860db1439.

Commit de CI añadido: ca040a6e03401dcb0f1674a91752b0b39a665c4d. Incluye solamente .github/workflows/pswe07-web-date-divider.yml. El PR ahora contiene tres archivos y dos commits: los dos archivos de Sofía y el workflow académico. No se modificó la corrección para cerrar los controles.

## Entorno y dificultades resueltas

Se usó Node 24.11.1, de acuerdo con la versión 24.11 fijada por el repositorio. Su distribución oficial se verificó mediante SHA-256. npm 11.6.2 falló al preparar una dependencia Git antigua; se utilizó npm 11.21.1 instalado de forma aislada.

La caché LMDB de Parcel no puede abrirse en el entorno restringido de este Mac. Se construyó platform/shared con la API admitida de Parcel y FSCache; platform/components se construyó normalmente después. La comprobación de tipos completa terminó con éxito. El adaptador local de caché, los recursos generados y las dependencias instaladas no se incluyeron en el PR. En Linux, el CI completó npm ci y los builds del proyecto sin ese adaptador.

## Validación visual ejecutada

Ejecución final: https://github.com/thegabrielobo/mattermost/actions/runs/43276950292; artefacto 13972175777. Rama separada pswe07-web-visual-check, commit 0816093d9e50bf0d5b7217ec3660fca97138892c. El workflow terminó con éxito; esto no equivale a haber reproducido el defecto original.

Se usó Mattermost 11.8, PostgreSQL 16, Chromium real mediante Playwright 1.62.1, datos ficticios creados por API y viewport 390 por 844. Cada versión completó seis cargas y cuatro cambios de canal mediante el selector rápido; estos últimos con CPU limitada a 2×. Se probaron dos canales de dos días y un control de un día, sin forzar el estado del componente.

- La base activó el indicador durante 106 a 117 fotogramas iniciales por entrada; la corrección no lo activó en ninguna de las diez entradas. Esto respalda el efecto del guard implementado.
- No se observó un fotograma con la fecha anterior visible en ninguna de las dos versiones. La reproducción del síntoma original es inconclusa; no se afirma que su desaparición haya sido demostrada visualmente.
- El scroll manual movió scrollTop de 3122 a 2422 y activó el indicador Today en ambas versiones. El botón de regreso dejó top=3122, altura=3756 y viewport=634: quedó en el final.
- En escritorio 1280 por 900 no hubo indicador flotante. La captura final se tomó después de cerrar el panel de bienvenida.
- Los cambios de canal terminaron sin timeout en la ejecución final.

Limitaciones: Chromium con viewport reducido, sin Safari ni dispositivo físico. Cada fase registró ocho errores de cuenta/equipo con el mismo mensaje de cuenta inexistente o invitación requerida; se conservan en los resultados JSON. Los canales y controles descritos sí se renderizaron y operaron; no se atribuye un origen al error de cuenta sin investigarlo. No se declara el webapp completo libre de errores.

Las capturas y videos son de la interfaz real. Los resultados y fotogramas se conservan en visual-verificado; los intentos previos de preparación quedan separados. El script privado con las contraseñas ficticias no forma parte del artefacto.

## Uso para el avance

Los controles técnicos web, publicación y CI están comprobados. La validación visual fue ejecutada, pero el criterio de eliminar la fecha errónea continúa sin demostración comparativa porque la base no mostró ese síntoma. La revisión formal y la integración siguen pendientes; no se aprobó ni fusionó ningún PR.
