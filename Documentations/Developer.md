# Tetris Idle Game – fejlesztői dokumentáció

Böngészős játék, ahol ládákból Tetris-alakzatokat szerzünk, ezeket az inventoryból a játéktáblára húzzuk, és a teljesen kitöltött sorok és oszlopok eltűnnek (mint a Block Blast vagy az 1010!). A pénz, az időzítő, az Upgrade és Buff láda, valamint az események még nincsenek megvalósítva.

## Felépítés

```
Game/
├── json/                 json-server (Docker), az adatbázissal
│   └── databases/db.json
└── web/                  nginx (Docker)
    └── www/              maga a játék
        ├── index.html
        ├── css/          style, colors, layout, responsive
        ├── js/           data, theme, popup, game, app, placement
        └── src/          képek, ikonok
```

A frontend sima HTML, CSS és JavaScript (ES modulok), nincs framework és build lépés. A játék állapotát nem a böngésző tárolja, hanem a json-server, ezért az oldal frissítése után is folytatható a játék.

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

A játék ezután a `http://localhost` címen érhető el (a port a `.env`-ben állítható). A compose-ban van egy PHP konténer is, de a játék nem használja.

Fontos, hogy a játék a `db.json` fájlba ír, mert az be van mountolva a konténerbe. Commit előtt érdemes visszaállítani a tiszta állapotot: üres `INVENTORY_ITEM` és `PLACEMENT`, és `GAME_SESSION.difficulty_id: null`.

## Adatbázis

A [db.json](../Game/json/databases/db.json) minden kulcsából a json-server végpontot csinál (`GET /SHAPE`, `PUT /SHAPE/1` stb.). A `GAME_SESSION` objektum, nem lista, ezért azt id nélkül kell lekérni és `PUT`-olni.

- `DIFFICULTY`: nehézségi szintek (`easy` 10×10, `normal` 8×8, `hard` 6×6), a `grid_size` adja a tábla méretét.
- `GAME_SESSION`: az aktuális játék (`difficulty_id`, `money`, `last_save_at`). Ha a `difficulty_id` `null`, nincs aktív játék.
- `SHAPE`: a 7 alap tetromino (`i o t s z j l`) a cellákkal és a `base_value`-val.
- `INVENTORY_ITEM`: az inventoryban lévő alakzatok (`shape_id`, `value`, és elforgatás után `cells`).
- `PLACEMENT`: a táblára lerakott alakzatok (`shape_id`, `value`, `cells`, `x_coord`, `y_coord`).
- `EVENT_TYPE`, `GAME_EVENT`, `BOARD_CELL`: előkészítve, de a kód még nem használja.

Az alakzatok cellái egy 4×4-es dobozon belüli `[oszlop, sor]` párok, például a T alakzat:

```js
cells: [[1,0], [0,1], [1,1], [2,1]]
```

Lerakáskor az `x_coord` és `y_coord` azt a tábla-koordinátát jelenti, ahová ennek a 4×4-es doboznak a bal felső sarka kerül. Egy cella helye a táblán így `(x_coord + oszlop, y_coord + sor)`. Mivel az alakzatok a dobozon belül nem mindig a bal felső sarokban vannak, az `x_coord` negatív is lehet.

Az `id`-k egy része string (`"0"`), a kliens által generáltak viszont számok, ezért van a kódban sok `Number(...)`.

## JavaScript fájlok

Mind az [index.html](../Game/web/www/index.html)-ben töltődik be `type="module"`-ként.

### [data.js](../Game/web/www/js/data.js)

A json-server felé menő `fetch` hívások egy helyen: `fetchDb`, `postDb`, `putDb` (singleton felülírása), `putDbById` és `deleteDbById`. A szerver címe a `BASE_URL`. A többi fájl csak ezeken keresztül kommunikál a szerverrel. Hibakezelés nincs benne, azt a hívó végzi, a `deleteDbById` pedig `true/false`-t ad vissza.

### [theme.js](../Game/web/www/js/theme.js)

A téma gomb kattintására átváltja a `<html data-theme>` értékét `dark` és `light` között, és elmenti a `localStorage`-ba. A betöltéskori témát egy kis inline script állítja be az `index.html` elején, még a CSS előtt, hogy ne villanjon be rossz téma. A színeket a [colors.css](../Game/web/www/css/colors.css) kezeli.

### [popup.js](../Game/web/www/js/popup.js)

Két függvénye van:

- `showGridPopup()` felépíti a nehézségválasztó ablakot a `DIFFICULTY` lista alapján. A start gomb elmenti a sessiont (`saveGameSession`), bezárja az ablakot és legenerálja a táblát (`generatePlayGrid`).
- `addNewGameButton()` hozzáad egy újraindítás gombot a menühöz, ami törli a mentést (`clearGameSession`), majd újra megnyitja a popupot.

### [game.js](../Game/web/www/js/game.js)

A játék indítása és a tábla kirajzolása:

- `loadGameSession()` megnézi, van-e mentett játék, és visszaadja a hozzá tartozó tábla méretét.
- `saveGameSession()` és `clearGameSession()` menti, illetve törli a sessiont (utóbbi az inventoryt és a lerakott alakzatokat is).
- `generatePlayGrid(size)` kiüríti a `#playgrid`-et és létrehoz egy `size × size` méretű rácsot `.play-cell` elemekből.

A fájl végén lévő `initGame()` induláskor vagy folytatja a mentett játékot, vagy megnyitja a popupot. A `game.js` és a `popup.js` egymást is importálja, ez működik, mert a függvényeket csak később, futás közben hívják.

### [app.js](../Game/web/www/js/app.js)

A neve félrevezető: ez az inventory és a Shape Chest modulja, nem az alkalmazás belépési pontja (érdemes lenne `inventory.js`-re nevezni).

Induláskor betölti a `SHAPE` és `INVENTORY_ITEM` listát, és kirajzolja az inventoryt (`refreshInventory()`, ezt hívja a `placement.js` is). Minden elem egy `.inventory-item` kártya egy 4×4-es mini rácsal, az értékkel és egy forgató gombbal. A kártya `data-*` attribútumaiban benne van az elem összes adata, a `placement.js` innen olvassa ki, mit húz a játékos.

A forgatás 90°-kal elforgatja a cellákat a 4×4-es dobozban (`[oszlop, sor] → [3 - sor, oszlop]`), és az új `cells` értéket elmenti az `INVENTORY_ITEM`-be. A Shape Chest gomb egy véletlen alakzatot ment az inventoryba (érték: 5 + 0–5), és tiltva van, ha már 8 elem van benne.

### [placement.js](../Game/web/www/js/placement.js)

Ez a legnagyobb fájl, itt dől el, hogy az inventoryból a táblára kerül-e egy alakzat. Nem exportál semmit, importáláskor magától bekötődik az eseményekre. A `data.js`-t és az `app.js` `refreshInventory()` függvényét használja, a `game.js`-ről viszont nem tud.

**A tábla felismerése.** A táblát a `getBoard()` a DOM-ból olvassa ki (`.playgrid-grid > .play-cell`, a méret a cellák számának gyöke). Mivel a táblát a `game.js` később hozza létre, egy `MutationObserver` figyeli a `#playgrid`-et, és amint új tábla jelenik meg, lefut a `loadPlacements()`, ami lekéri a `PLACEMENT` listát. Ezután a `renderPlacements()` kirajzolja a lerakott alakzatokat, és feltölti az `occupied` map-et (`"oszlop,sor"` → placement id), amivel az ütközést gyorsan lehet vizsgálni. A `boardLoadToken` arra jó, hogy ha gyorsan két betöltés indul, csak az utolsó eredménye számítson.

**Húzás.** Az inventory `pointerdown` eseményére létrejön a `drag` objektum. Pointer Eventeket használ, így egérrel és érintéssel is ugyanúgy működik. A húzás csak 4 pixel mozgás után indul el (`DRAG_START_DISTANCE`), hogy a forgató gomb kattintása ne indítson húzást. Ekkor a `startDrag()` létrehoz egy `.drag-ghost` elemet, amit a tábla cellaméretéhez igazít (`getBoardMetrics()`), így pont akkora, mint a végleges alakzat. Egy `requestAnimationFrame` ciklus (`dragFrame`) minden képkockában:

- görgeti az oldalt, ha a kurzor a képernyő széléhez közel van,
- meghívja az `updateDrag()`-ot, ami mozgatja a ghostot, kiszámolja, melyik tábla-cellára esik az alakzat bal felső sarka (kerekítéssel, így rácshoz igazodik), és zöld vagy piros előnézetet fest a táblára.

A húzás elengedésre (`pointerup`) vagy `Escape`-re ér véget. Elengedéskor csak akkor történik lerakás, ha az utolsó előnézet érvényes volt.

**Érvényesség.** A `checkPlacement()` szerint egy lerakás akkor jó, ha az alakzat minden cellája a táblán belül van, és egyik sem foglalt.

**Lerakás.** A `dropOnBoard()` sorrendben: újraellenőrzi az érvényességet, kiszámolja a kitöltött sorokat, `POST`-tal elmenti a `PLACEMENT`-et, `DELETE`-tel kiveszi az `INVENTORY_ITEM`-et, majd törli a kész sorokat és kirajzolja a táblát. Ha az inventory elem törlése nem sikerül, visszavonja a már elmentett `PLACEMENT`-et, hogy ne maradjon ugyanaz az alakzat egyszerre az inventoryban és a táblán. Az `isSaving` zászló megakadályozza, hogy mentés közben új húzás induljon, a `finally` ágban pedig mindig újratöltődik az inventory.

**Sorok törlése.** A `getCompletedLines()` megnézi, mely sorok és oszlopok lennének tele az új alakzattal együtt. A `clearCompletedLines()` ezután végigmegy a lerakott alakzatokon: ha egy alakzat minden cellája törlődik, a rekordot törli, ha csak egy része, akkor frissíti a megmaradt cellákkal. Egy alakzat tehát szétdarabolódhat, de ugyanaz a rekord marad. Pénz a törlésért egyelőre nem jár.

Bővítéskor: a lerakási szabályokat a `checkPlacement()`-be érdemes írni, a pontszámot vagy pénzt pedig a `dropOnBoard()`-ba, a `getCompletedLines()` eredménye alapján. Az alakzatméret (4) a forgatásban (`app.js`) és a CSS rácsaiban is szerepel, ezért ha változik, mindhárom helyen módosítani kell.

## HTML

Egyetlen oldal ([index.html](../Game/web/www/index.html)) három részből:

- a felső menüsáv: bal oldalt a GitHub link, középen az időzítő és a pénz helyőrzője, jobb oldalt a téma gomb (ide teszi a `popup.js` az újraindítás gombot is),
- a `main`: bal oldalt a bolt (`#chests` a három ládával, alatta az `#inventory`), jobb oldalt a `#playgrid`, amit a JS tölt fel,
- a lábléc a készítőkkel.

Csak a Shape Chest gombnak (`#shape-chest-button`) van működése, a másik két ládáé még nem. A JS több elemet id vagy osztály alapján keres (`#inventory`, `#playgrid`, `#shape-chest-button`, `#theme-toggle`, `.menu-theme`), ezeket ne nevezd át a JS módosítása nélkül.

## CSS

- [colors.css](../Game/web/www/css/colors.css): színpaletta és a téma változói (`--background`, `--surface`, `--accent`, `--valid`, `--invalid` stb.). A világos téma a `[data-theme="light"]` blokkban írja felül a változókat. Színt mindig változóval használj.
- [layout.css](../Game/web/www/css/layout.css): az elrendezés (flex és grid), az inventory 4×2-es rácsa, a `.drag-ghost` pozícionálása.
- [style.css](../Game/web/www/css/style.css): a komponensek kinézete (gombok, inventory kártyák, tábla cellák, popup).
- [responsive.css](../Game/web/www/css/responsive.css): 768 px alatt a bolt és a tábla egymás alá kerül, 1200 px alatt az inventory kap több helyet, érintőképernyőn a húzott alakzat áttetszőbb.

A JS által kapcsolgatott osztályokat a CSS stílusozza: `play-cell-filled` (foglalt cella), `play-cell-preview-valid` és `-invalid` (előnézet húzás közben), `drag-ghost` (a mozgó alakzat), `inventory-item-dragging` (a húzott kártya) és `is-dragging` a `body`-n.

## Tennivalók

- A `game.js`-ben a `refresh` hiba javítása (lásd fent). Mellette a `BASE_URL` és `postDb` import fölösleges.
- Az `app.js` átnevezése `inventory.js`-re.
- Időzítő, pénz, Upgrade és Buff láda, események, pontozás a törlt sorokért.
- A `db.json` a játék közben módosul, érdemes külön tiszta alapfájlt tartani.
- A `data.js` nem ellenőrzi a HTTP státuszt (a `deleteDbById` kivételével).
