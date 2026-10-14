# Tetris Idle Game – fejlesztői dokumentáció

Böngészős játék, ahol ládákból Tetris-alakzatokat szerzünk, ezeket az inventoryból a játéktáblára húzzuk, és a teljesen kitöltött sorok és oszlopok eltűnnek (mint a Block Blast vagy az 1010!). A játékban van pénz és passzív jövedelem, háromféle láda (Shape, Upgrade, Buff), időzített események, game over és újraindítás.

A játékszabályok felhasználói leírása a [README.md](../README.md)-ben, az adatbázis leírása az [SQL_Diagram.md](SQL_Diagram.md)-ben van.

## Felépítés

```
Game/
├── json/                 json-server (Docker), az adatbázissal
│   └── databases/db.json
└── web/                  nginx (Docker)
    └── www/              maga a játék
        ├── index.html
        ├── css/          style, colors, layout, responsive
        ├── js/           data, theme, popup, game, app, money, placement, chests, events, gameover
        └── src/          képek, ikonok
```

A frontend sima HTML, CSS és JavaScript (ES modulok), nincs framework és build lépés. A játék állapotát (pénz, készlet, tábla, futó esemény) nem a böngésző tárolja, hanem a json-server, ezért az oldal frissítése után is folytatható a játék. Egyedül a téma van a `localStorage`-ban.

## Futtatás

Két Docker rész kell hozzá. Először az adatbázis szerver:

```bash
cd Game/json
docker build -t json/json-alpine .
docker run -d --name json -p 3000:3000 -v "./databases/db.json:/data/db.json" json/json-alpine /data/db.json
```

Utána a weboldal (első alkalommal másold le a `.env-example` fájlt `.env` néven):

```bash
cd Game/web
docker compose up -d
```

A játék ezután a `http://localhost` címen érhető el (a port a `.env`-ben állítható, alapértelmezetten 80). A compose-ban van egy PHP konténer is, de a játék nem használja. A kliens a json-servert a `http(s)://<aktuális host>:3000` címen keresi (`BASE_URL`), ezért a 3000-es portnak a böngészőből elérhetőnek kell lennie.

Fontos, hogy a játék a `db.json` fájlba ír, mert az be van mountolva a konténerbe. Commit előtt érdemes visszaállítani a tiszta állapotot (lásd [SQL_Diagram.md](SQL_Diagram.md#tiszta-kezdőállapot)).

## Adatbázis röviden

A [db.json](../Game/json/databases/db.json) minden kulcsából a json-server végpontot csinál (`GET /SHAPE`, `PUT /SHAPE/1` stb.). A `GAME_SESSION` és a `GAME_EVENT` objektum, nem lista, ezért ezeket id nélkül kell lekérni és `PUT`-olni (`putDb`). A táblák részletes leírása az [SQL_Diagram.md](SQL_Diagram.md)-ben van.

Az alakzatok cellái egy 4×4-es dobozon belüli `[oszlop, sor]` párok, például a T alakzat:

```js
cells: [[1,0], [0,1], [1,1], [2,1]]
```

Lerakáskor az `x_coord` és `y_coord` azt a tábla-koordinátát jelenti, ahová ennek a 4×4-es doboznak a bal felső sarka kerül. Egy cella helye a táblán így `(x_coord + oszlop, y_coord + sor)`. Mivel az alakzatok a dobozon belül nem mindig a bal felső sarokban vannak, az `x_coord` negatív is lehet.

Az `id`-k egy része string (`"0"`), a json-server által generáltak viszont számok, ezért van a kódban sok `Number(...)` és `String(...)` összehasonlítás.

## JavaScript fájlok

Az [index.html](../Game/web/www/index.html) csak a `theme.js`-t és a `game.js`-t tölti be `type="module"`-ként, a többit a `game.js` importálja.

Függőségek egy pillantásra (nyíl: importálja):

```
game.js ──► popup.js ──► data.js
   ├──────► money.js ──► data.js
   ├──────► app.js ────► data.js
   ├──────► events.js ─► data.js, money.js
   ├──────► gameover.js ► data.js, popup.js, money.js, placement.js, app.js, events.js
   ├──────► placement.js ► data.js, app.js, money.js, events.js, popup.js
   └──────► chests.js ─► data.js, money.js, app.js, popup.js, events.js, gameover.js
```

A `game.js` az egyetlen belépési pont: ő köti össze a modulokat (`initGameOver`, `onBoardChange(checkGameOver)`, `addNewGameButton`), a többi modul egymásnak callbackeket (`onBoardChange`, `onEventEnd`, `onEventChange`, `setAfterWrite`) adva kommunikál, hogy ne legyen körkörös import.

### [data.js](../Game/web/www/js/data.js)

A json-server felé menő `fetch` hívások egy helyen: `fetchDb`, `postDb`, `putDb` (singleton felülírása), `putDbById` és `deleteDbById`. A szerver címe a `BASE_URL`. Mind egy közös `request()` függvényre épül, ami:

- `cache: "no-store"`-ral kér, hogy ne jöjjön vissza elavult adat,
- **hibát dob**, ha a HTTP státusz nem sikeres (`GET /path -> 404 ...` formátumú üzenettel), tehát a hívóknak `try/catch`-et kell használniuk,
- üres válasznál (pl. `DELETE`) `null`-t ad vissza,
- támogatja a `keepalive` beállítást (a `putDb` harmadik paramétere), amit az oldal elhagyásakori mentés használ,
- minden **sikeres, nem `GET` és nem `GAME_SESSION`-re irányuló** írás után meghívja a `setAfterWrite()`-tel regisztrált callbacket (ezt a `money.js` használja: mentés előtt jóváírja a felgyűlt jövedelmet és elmenti a pénzt). A callback hibája csak a konzolra kerül, az adatírás nem számít sikertelennek.

### [theme.js](../Game/web/www/js/theme.js)

A téma gomb kattintására átváltja a `<html data-theme>` értékét `dark` és `light` között, és elmenti a `localStorage`-ba. A betöltéskori témát egy kis inline script állítja be az `index.html` elején, még a CSS előtt, hogy ne villanjon be rossz téma. A színeket a [colors.css](../Game/web/www/css/colors.css) kezeli.

### [popup.js](../Game/web/www/js/popup.js)

Az összes felugró ablak itt van, **egyetlen sorban**: egyszerre csak egy popup látszik, a közben megnyitottak megvárják, amíg az előző bezárul (így pl. egy game over üzenet nem veszhet el egy ládaablak mögött).

- `showGridPopup(onStart)`: a nehézségválasztó ablak a `DIFFICULTY` lista alapján. Sosem kerül kétszer a sorba. Amíg a nehézségek töltődnek, a start gomb tiltott, ha a szerver nem érhető el, a cím „server unreachable"-re változik. A start gomb meghívja az `onStart(difficulty)` callbacket, siker esetén bezárja az ablakot, hiba esetén újra engedélyezi a gombot.
- `showMessagePopup(title, lines, isError, options)`: általános üzenetablak (ládaeredmények, hibák, game over, eredmény). Az `options`:
  - `icon`: kép a cím fölött,
  - `highlight`: nagy, kiemelt sor a cím alatt (pl. az esemény neve),
  - `rows`: `[[címke, érték], ...]` kis táblázat (a game over eredményhez),
  - `closeLabel`: a gomb szövege (alapértelmezés: `ok`),
  - `dismissible`: `false` esetén csak a gomb zárja be (Esc, Enter, háttérkattintás nem),
  - `onClose`: az ablak bezárása után hívódik meg.
- `addNewGameButton(onClick)`: újraindítás gomb a menühöz (`.menu-theme`).

### [game.js](../Game/web/www/js/game.js)

A játék indítása, újraindítása és a tábla kirajzolása:

- `loadGameSession()` megnézi, van-e mentett játék, és visszaadja a hozzá tartozó tábla méretét.
- `saveGameSession(difficulty_id)` új sessiont ment `STARTING_MONEY` (100) pénzzel és `started_at` időbélyeggel, majd elindítja a pénzrendszert.
- `clearGameSession()` leállítja a pénzrendszert, megvárja a függő mentéseket, törli az eseményt (`resetEvents`), alaphelyzetbe állítja a sessiont, törli az összes inventory elemet és lerakott alakzatot, és **nullázza a `SHAPE` táblában az összes `base_value`-t** (a Fejlesztőláda hatása csak egy játékra szól). Ha valamelyik lépés nem sikerült, hibát dob.
- `generatePlayGrid(size)` kiüríti a `#playgrid`-et és létrehoz egy `size × size` méretű rácsot `.play-cell` elemekből.
- `startGame(difficulty)` és `restartGame()`: a popuphoz/gombhoz kötött függvények. A `restartGame` az `isRestarting` zászlóval védi magát a dupla indítástól, törli a régi állapotot (tábla, placementek, inventory), majd újra megnyitja a nehézségválasztó popupot. Mindkettő nullázza a game over állapotot (`resetGameOver`).

Az `initGame()` induláskor bekötéseket végez (`addNewGameButton`, `initGameOver`, `onBoardChange(checkGameOver)`), majd vagy folytatja a mentett játékot, vagy megnyitja a popupot. A folytatás sorrendje számít: `restoreEvent()` → `startMoneySystem()` → tábla és `loadPlacements()` → `settleExpiredEvent()` → `checkGameOver()`. Az eseményt azért kell a pénzrendszer előtt betölteni, mert a távollét alatt gyűlt jövedelem kiszámításához tudni kell egy esetleges Aranylázról.

### [money.js](../Game/web/www/js/money.js)

A pénz és a passzív jövedelem modulja. Az állapot (`money`, `passiveIncome`, `gameSession`, `incomeBoost`) modulszintű változókban van, a kijelzést a menüsáv `#player-money` eleme mutatja (`123 $ | +4 $/s`, a jövedelem a futó Aranyláz szorzóját is tartalmazza).

- `startMoneySystem()` betölti a `GAME_SESSION`-t és a `PLACEMENT`-eket, kiszámolja a passzív jövedelmet, jóváírja a `last_save_at` óta eltelt idő jövedelmét (az Aranyláz csak arra az időszakra számít, amikor tényleg futott), majd elindít egy másodpercenkénti `setInterval`-t. Ha nincs aktív játék (`difficulty_id` `null`), nem csinál semmit.
- `stopMoneySystem()` leállítja az időzítőt és nullázza az állapotot (a boostot nem, az az eseményé).
- `accrueIncome()` a legutóbbi tick óta eltelt **egész másodperceket** írja jóvá, így akkor is helyes marad, ha a böngésző a háttérben lelassítja az időzítőt. Az `earnedBetween()` kezeli, hogy a boost csak az esemény idejére vonatkozzon.
- `setIncomeBoost({ multiplier, startsAt, endsAt })`: az `events.js` hívja Aranyláz indulásakor/végén (előbb az addig felgyűlt pénzt a régi boosttal számolja el).
- `addMoney(amount)` és `spendMoney(cost)`: hozzáadás, illetve költés. A `spendMoney` `false`-t ad, ha nincs elég pénz, és hiba esetén visszaadja a levont összeget. Mindkettő elmenti a sessiont.
- `updatePassiveIncome(placements)` a lerakott alakzatok alapján újraszámolja a jövedelmet.
- `getMoney()`, `getGameSession()`, `formatMoney()`: a `gameover.js` használja az eredményablakhoz.
- `showLineReward(amount)`: a sortörlés jutalmának lebegő felirata (`+X $`) a menüsávban (`#line-reward-popup`, Web Animations API).
- Mentés: a mentések egy soron (`saveQueue`) mennek egymás után, hogy ne írják felül egymást. A pénz elmentődik minden pénzt érintő műveletnél, **minden más adatírás után** (a `data.js` `setAfterWrite` hookján keresztül), valamint az oldal elhagyásakor/elrejtésekor (`pagehide`, `visibilitychange`, `keepalive`-os kéréssel). A másodpercenkénti tick maga nem ment. A `waitForPendingSaves()` megvárja a függő mentéseket új játék előtt.

### [app.js](../Game/web/www/js/app.js)

A neve félrevezető: ez az inventory modulja, nem az alkalmazás belépési pontja (érdemes lenne `inventory.js`-re nevezni). A ládák kattintáskezelője a `chests.js`-ben van.

Induláskor betölti a `SHAPE` és `INVENTORY_ITEM` listát (a `SHAPE` csak egyszer töltődik, a promise gyorsítótárazva van), és kirajzolja az inventoryt. Minden elem egy `.inventory-item` kártya egy 4×4-es mini rácsal, az értékkel és egy forgató gombbal. A forgatás 90°-kal elforgatja a cellákat a 4×4-es dobozban (`[oszlop, sor] → [3 - sor, oszlop]`), és az új `cells` értéket elmenti az `INVENTORY_ITEM`-be.

Exportok:

- `refreshInventory()`: újratölti és kirajzolja az inventoryt (egy token védi az elavult válaszok ellen), és beállítja a Shape Chest gomb tiltását.
- `getInventoryItem(id)`: a húzott elem adatai a `placement.js`-nek (a kártyán csak a `data-inventory-item-id` van, minden más innen jön).
- `removeInventoryItem(id)`: kiveszi az elemet a memóriából és a DOM-ból újratöltés nélkül (lerakás után, hogy ne villogjon az inventory).
- `isInventoryFull()`, `getFreeInventorySlots()`: a ládák és a Dupla alakzat esemény használja (`MAX_INVENTORY_ITEMS` = 8).
- `getInventoryShapes()`, `getBaseShapes()`: a game over ellenőrzés használja.

A `SHAPE` itt gyorsítótárazott, ezért **a ládák nem innen, hanem mindig frissen a szerverről olvassák a `base_value`-t**, különben a Fejlesztőláda hatása nem látszana.

### [chests.js](../Game/web/www/js/chests.js)

A három láda gombjának kezelője. Az árak a fájl elején vannak (`SHAPE_CHEST_COST` 100, `UPGRADE_CHEST_COST` 2500, `BUFF_CHEST_COST` 5000), a gombok feliratát is innen állítja be. Minden láda ugyanazt a mintát követi: pénz levonása (`spendMoney`) → a hatás mentése a szerverre → eredményablak; ha a mentés elbukik, a pénz visszajár (`refund`), hiba esetén piros hibaablak jelenik meg. Az eredmények és hibák a `console.warn`-ba is bekerülnek.

- **Shape Chest:** véletlen alakzat a frissen lekért `SHAPE` listából, az értéke `base_value + 6–10`. Ha az inventory tele van, a gomb tiltva van. Dupla alakzat esemény alatt `min(2, szabad hely)` azonos másolatot ment. Az `INVENTORY_ITEM` `id`-t a szerver generálja. Nyitás után lefut a `checkGameOver()`, mert az új alakzat lehet olyan, ami sehova nem fér.
- **Upgrade Chest:** véletlen alap alakzat `base_value`-ja nő 10–50-nel (`PUT /SHAPE/{id}`). Csak az utána nyitott alakzatokra hat, a készletben és a táblán lévők megtartják a saját értéküket. Az eredményablak mutatja a régi és új értéket.
- **Buff Chest:** egy véletlen eseményt választ az `EVENT_TYPE` listából (egyenlő eséllyel), `queueEvent()`-tel elmenti, és az ablakban mutatja. Az időzítő az ablak bezárásakor indul (`onClose: startPendingEvent`). Amíg egy esemény nyitva van vagy fut (`isEventBusy()`), a gomb tiltva van (az `onEventChange` frissíti).

### [events.js](../Game/web/www/js/events.js)

Az időzített események (Buff láda). Egyszerre egy esemény lehet aktív. Az esemény a `GAME_EVENT` táblába kerül (nem az inventoryba), az időtartamot az `EVENT_TYPE` adja, a hatások az `EVENT_DEFINITIONS` objektumban vannak:

| Esemény | Hatás | Ki használja |
|---------|-------|--------------|
| `gold_rush` | passzív jövedelem ×2 | `money.js` (`setIncomeBoost`) |
| `double_shape` | minden nyitott alakzat másolatot kap | `chests.js` (`getShapeCopies`) |
| `time_freeze` | a kész sorok nem törlődnek a fagyás végéig | `placement.js` (`isGridFrozen`) |
| `value_burst` | sorjutalmak ×1,5 | `placement.js` (`getLineRewardMultiplier`) |

Életciklus: `queueEvent(type)` (kinyitva, még nem fut, `started_at`/`expires_at` üres) → `startPendingEvent()` (az ablak bezárásakor indul, 250 ms-os tick frissíti a `#game-timer` kijelzőt és az `#event-icon`-t) → `finishActiveEvent()` (törli a rekordot, majd meghívja az `onEventEnd` figyelőket; ekkor az esemény hatása már nem él). A `document.body.dataset.event` az esemény nevét tartalmazza, a CSS ezzel színezi az oldalt.

Mentés/betöltés: `restoreEvent()` újratöltés után folytatja a futó eseményt. Ha az oldal bezárása alatt járt le, a `settleExpiredEvent()` zárja le a tábla betöltése után (egy Időbefagyasztásnál ekkor fizetődnek ki a kész sorok). Ha kinyitott, de el nem indított esemény volt, az újratöltéskor indul. `resetEvents()` új játékhoz mindent eldob (az end figyelők nem hívódnak). A GAME_EVENT írásai sorba vannak állítva, hogy egy késői „üres" mentés ne írjon felül egy újabb eseményt.

### [placement.js](../Game/web/www/js/placement.js)

Ez a legnagyobb fájl, itt dől el, hogy az inventoryból a táblára kerül-e egy alakzat, és itt számolódik a sortörlés jutalma. Exportjai: `loadPlacements()`, `resetPlacements()`, `getBoardSnapshot()` (a game overnek), `onBoardChange(listener)`. Az események bekötése importáláskor történik.

**A tábla.** A táblát a `getBoard()` a DOM-ból olvassa ki (`.playgrid-grid > .play-cell`, a méret a cellák számának gyöke). A lerakott alakzatokat a `loadPlacements()` kéri le a `PLACEMENT` végpontról, a `renderPlacements()` kirajzolja őket és feltölti az `occupied` map-et (`"oszlop,sor"` → placement id). A `boardLoadToken` biztosítja, hogy ha két betöltés indul, csak az utolsó számít. A szerver az igazság forrása: lerakás előtt és után mindig újratöltődnek a placementek.

**Húzás.** Az inventory `pointerdown` eseményére létrejön a `drag` objektum (Pointer Events, egérrel és érintéssel is). A húzás csak 4 pixel mozgás után indul el (`DRAG_START_DISTANCE`), hogy a forgató gomb kattintása ne indítson húzást. A `startDrag()` egy `.drag-ghost` elemet hoz létre a tábla cellaméretére igazítva, egy `requestAnimationFrame` ciklus (`dragFrame`) pedig görgeti az oldalt a képernyő szélénél, mozgatja a ghostot és zöld vagy piros előnézetet fest (`updateDrag`). A húzás elengedésre vagy `Escape`-re ér véget, lerakás csak érvényes előnézetnél történik. Az érvényességet a `checkPlacement()` adja: minden cella a táblán belül van, és egyik sem foglalt.

**Lerakás.** A `dropOnBoard()` a `withBoardLock()`-on keresztül futtatja a `placeShape()`-et, így a lerakás és a fagyott sorok kifizetése nem futhat egyszerre. A `placeShape()` sorrendje:

1. placementek újratöltése és érvényesség újraellenőrzése,
2. kitöltött sorok kiszámítása (`getCompletedLines`),
3. `POST` a `PLACEMENT`-be, `DELETE` az `INVENTORY_ITEM`-re, majd `removeInventoryItem`,
4. **Időbefagyasztás alatt** itt vége: a sorok a táblán maradnak, csak a passzív jövedelem frissül,
5. a jutalom kiszámítása a törlés előtt (`getCompletedLineReward`, mert a törlés módosítja a placementeket),
6. animáció és törlés (`clearCompletedLines`), a passzív jövedelem frissítése,
7. `addMoney(jutalom)` és a lebegő `+X $` felirat (`showLineReward`).

Ha valamelyik lépés elbukik, a már elmentett `PLACEMENT` visszavonódik, és a placementek és az inventory újratöltődnek. Az `isSaving` zászló megakadályozza, hogy mentés közben új húzás induljon. A lerakás végén `notifyBoardChange()` hívja a figyelőket (a `game.js` ide kötötte a `checkGameOver`-t).

**Sorok törlése.** A `clearCompletedLines()` először lejátssza a törlési animációt (`play-cell-clearing`), majd **egymás után** (nem párhuzamosan, mert a json-server fájlba ír) végigmegy az érintett alakzatokon: ha egy alakzat minden cellája törlődik, a rekordot törli, ha csak egy része, akkor frissíti a megmaradt cellákkal. A rekord (és az `value`) megmarad, így az alakzat jövedelme sem csökken, amíg legalább egy cellája megvan.

**Jutalom.** A `getLineReward()` egy vonalra összegzi az abban érintett alakzatok értékét és megszorozza az alakzatok számával. A `getCompletedLineReward()` összeadja az összes vonal jutalmát, és megszorozza a kombó szorzóval és az Értékrobbanás szorzójával:

```
jutalom = Σ vonal_jutalom · max(2, 1 + 0,25 · (vonalak − 1)) · getLineRewardMultiplier()
```

> Megjegyzés: a `max(2, …)` miatt a kombó szorzó 1–5 egyszerre törölt vonalnál mindig 2, és csak 6 vagy több vonaltól nő (6 → 2,25). Ha az volt a szándék, hogy egy vonalnál ×1 legyen, és a kombó fokozatosan nőjön, akkor `max(1, …)` kell. A jutalom törtszám is lehet (Értékrobbanásnál ×1,5), a kijelzés `formatMoney()`-vel legfeljebb 2 tizedesre kerekít.

**Időbefagyasztás vége.** Az `onEventEnd` figyelő a `time_freeze` végén meghívja a `settleFrozenLines()`-t: a fagyás alatt kitöltött összes sort és oszlopot **egyetlen kombóként** fizeti ki (egész számra kerekítve), törli, és egy „Time Freeze ended" ablakban mutatja az eredményt.

Bővítéskor: a lerakási szabályokat a `checkPlacement()`-be érdemes írni, a pénzt a `getCompletedLineReward()`-ba. Az alakzatméret (4) a forgatásban (`app.js`), a `SHAPE_SIZE`-ban (`placement.js`, `gameover.js`) és a CSS rácsaiban is szerepel, ezért ha változik, mindenhol módosítani kell.

### [gameover.js](../Game/web/www/js/gameover.js)

A `checkGameOver()` a lerakás, a Shape Chest nyitás, az esemény vége és a betöltés után fut, és sosem dob hibát. A játék véget ér, ha az inventory **megtelt (8 elem)**, és egyik alakzat sem helyezhető le a táblán (a `canPlaceAnywhere()` mind a 4 elforgatást kipróbálja minden pozícióban). Időbefagyasztás alatt nem ellenőriz, mert a fagyás vége sorokat szabadít fel.

Ha vége a játéknak: „Game over" ablak (nem zárható be véletlenül) → „Your result" ablak (nehézség, pénz, játékidő a `started_at` alapján) → az „new game" gomb a `game.js` `restartGame`-jét hívja (`initGameOver({ onRestart })`).

> Megjegyzés: az `inventory.length !== 8` feltétel miatt a függvény üres inventoryval sosem jut el a `getBaseShapes()` ágig, így a „semelyik alap alakzat nem fér el, miközben a készlet üres" eset kezelése jelenleg nem működik (halott kód). Ha ez a szándék, a feltételt `inventory.length > 0 && inventory.length !== 8`-ra vagy hasonlóra kell módosítani.

## HTML

Egyetlen oldal ([index.html](../Game/web/www/index.html)) három részből:

- a felső menüsáv: bal oldalt a GitHub link, középen az esemény ikonja (`#event-icon`), az időzítő (`#game-timer`, `--:--`, ha nincs esemény), a pénz (`#player-money`) és a sortörlés lebegő felirata (`#line-reward-popup`), jobb oldalt a téma gomb (ide teszi a `popup.js` az újraindítás gombot is),
- a `main`: bal oldalt a bolt (`#chests` a három ládával: `#shape-chest-button`, `#upgrade-chest-button`, `#buff-chest-button`, alattuk az `#inventory`), jobb oldalt a `#playgrid`, amit a JS tölt fel,
- a lábléc a készítőkkel.

A JS az elemeket id vagy osztály alapján keresi (`#inventory`, `#playgrid`, `#player-money`, `#game-timer`, `#event-icon`, `#line-reward-popup`, a három láda gombja, `#theme-toggle`, `.menu-theme`), ezeket ne nevezd át a JS módosítása nélkül.

## CSS

- [colors.css](../Game/web/www/css/colors.css): színpaletta és a téma változói (`--background`, `--surface`, `--accent`, `--valid`, `--invalid` stb.). A világos téma a `[data-theme="light"]` blokkban írja felül a változókat. Színt mindig változóval használj.
- [layout.css](../Game/web/www/css/layout.css): az elrendezés (flex és grid), az inventory 4×2-es rácsa, a `.game-info` sáv, a `.drag-ghost` pozícionálása.
- [style.css](../Game/web/www/css/style.css): a komponensek kinézete (gombok, inventory kártyák, tábla cellák, popupok és animációik, esemény ikon és időzítő, a `body[data-event="..."]` esemény-színezés).
- [responsive.css](../Game/web/www/css/responsive.css): töréspontok 768 px, 1200 px, 480 px és 380 px alatt, érintőképernyőre (`pointer: coarse`) külön szabályok, és `prefers-reduced-motion` esetén az animációk kikapcsolása.

A JS által kapcsolgatott osztályok: `play-cell-filled` (foglalt cella), `play-cell-preview-valid` és `-invalid` (előnézet húzás közben), `play-cell-clearing` (törlési animáció), `drag-ghost`, `inventory-item-dragging`, `is-dragging` a `body`-n, `is-running` a `#game-timer`-en, `popup-window-error` a hibaablakon, valamint a `data-event` attribútum a `body`-n.

## Tennivalók

- Az `app.js` átnevezése `inventory.js`-re.
- A kombó szorzó és a game over feltétel felülvizsgálata (lásd a megjegyzéseket a `placement.js` és `gameover.js` fejezetnél).
- Hang és oktatóanyag (a [Game_Concept.md](Game_Concept.md) másodlagos céljai).
- A `db.json` a játék közben módosul, érdemes külön tiszta alapfájlt tartani.
- A pénz mentése pénzt érintő műveletnél, minden más adatírás után és az oldal elhagyásakor történik; ha a böngésző összeomlik, a legutóbbi mentés óta felgyűlt jövedelem a `last_save_at` alapján pótlódik betöltéskor.
