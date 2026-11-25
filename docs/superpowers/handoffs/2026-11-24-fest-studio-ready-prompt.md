# Промпт для новой беседы — перевод «Студии мультимедиа» (`studio`) в `ready`

Скопируйте текст ниже целиком в новую беседу (рабочая папка `D:\Antigravity Projects\fest-3dmodels-and-stages`).

---

Переведи площадку «Студия мультимедиа» (`studio`) из черновика в статус `ready` строго по готовым спецификации, плану и handoff. Исследование `data/studio/`, интервью `/grill-me` и проектирование уже завершены и утверждены в прошлой беседе — повторно их не проводи.

**Прочитай до начала работы, строго по порядку:**
1. `docs/superpowers/handoffs/2026-11-24-fest-studio-ready-handoff.md` — передача контекста: режим работы, состояние репозитория, таблица решений заказчика, 6 подводных камней, точки остановки.
2. `docs/superpowers/specs/2026-11-24-fest-studio-ready-design.md` — утверждённая спецификация (единственный источник размеров и решений).
3. `docs/superpowers/plans/2026-11-24-fest-studio-ready.md` — пошаговый план реализации (Tasks 0–10).
4. `AGENTS.md` и навыки проекта: `.agents/skills/venue-module-authoring/SKILL.md`, `theatrical-stage-rigging`, `stage-lighting-photometry`, `playwright-webgl-qa`, `mobile-cad-touch-ux`, `multi-persona-review`.
5. Навык `superpowers:executing-plans`, а также `test-driven-development` и `verification-before-completion`.

**Режим исполнения:**
- Разработку (Tasks 0–7 и Task 10) выполняешь сам последовательно в одном контексте (`executing-plans`), без субагентов-кодеров.
- Начни с **Task 0**: на текущем `master` собери `dist` и сними свежий эталон паритета `review/modular/baseline/dist-studio-ready-base` с обязательной самопроверкой `compare = 100 %` (`big, chamber, roof`), после чего создай ветку `studio-ready` и закоммить документацию `2026-11-24-fest-studio-ready*`.
- Приёмку в **Tasks 8–9** проведи параллельно 4 независимыми субагентами по `.agents/skills/multi-persona-review/SKILL.md` в 2 раунда (`studio-r1` и `studio-r2`): `model` (`flash`), `ui-desktop` (`flash`), `ui-mobile` (`flash`), `lighting` (`pro`). Требуй от каждого ревьюера жёсткие доказательства (прочитанные `read_file` снимки/фото, замеры в px, `window.__fest`, строки DXF; фразы «нужно проверить» запрещены).
- После каждого коммита отмечаешь выполненные шаги в `docs/superpowers/plans/2026-11-24-fest-studio-ready.md` (`- [x]`) и проверяешь счётчик `(git rev-list --count HEAD) % 10 === 0` → при кратности 10 запускаешь `cd app; npm.cmd run backup` (ближайшие рубежи — коммиты № 130 и № 140).
- Если всплывёт расхождение со спекой или непредусмотренный вопрос по размерам — не додумывай: остановись и задай мне один вопрос со своей рекомендацией через `ask_question`.

**Точки остановки, на которых ждёшь моего ответа:**
1. После Раунда 1 приёмки субагентами (`app/review/studio-r1/decisions.md`, Task 8 Step 3) — согласование принятых правок.
2. После Раунда 2 приёмки субагентами (`app/review/studio-r2/decisions.md`, Task 9 Step 2) — подтверждение перед переводом в `ready`.
3. На финальном показе на локальном сервере (`npm.cmd run dev`, Task 10 Step 6) — слияние `studio-ready → master` и `git push origin master` делаешь только после моего явного «ок».

Начинай с чтения handoff и выполнения Task 0.
