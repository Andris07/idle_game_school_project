# Tetris Idle Game – fejlesztői dokumentáció

Böngészős játék, ahol ládákból Tetris-alakzatokat szerzünk, ezeket az inventoryból a játéktáblára húzzuk, és a teljesen kitöltött sorok és oszlopok eltűnnek (mint a Block Blast vagy az 1010!). A lerakott alakzatok passzív jövedelmet termelnek, a törölt sorokért jutalom jár, a pénzből pedig új alakzatokat vehetünk. Az időzítő, az Upgrade és Buff láda, valamint az események még nincsenek megvalósítva.

## Felépítés

```
Game/
├── json/                 json-server (Docker), az adatbázissal
│   └── databases/db.json
└── web/                  nginx (Docker)
    └── www/              maga a játék
        ├── index.html
        ├── css/          style, colors, layout, responsive
        ├── js/           data, theme, popup, game, app, money, placement
        └── src/          képek, ikonok
```

A frontend sima HTML, CSS és JavaScript (ES modulok), nincs framework és build lépés. A játék állapotát (a pénzt is) nem a böngésző tárolja, hanem a json-server, ezért az oldal frissítése után is folytatható a játék. Egyedül a téma van a `localStorage`-ban.

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

Fontos, hogy a játék a `db.json` fájlba ír, mert az be van mountolva a konténerbe. Commit előtt érdemes visszaállítani a tiszta állapotot: üres `INVENTORY_ITEM` és `PLACEMENT`, és `GAME_SESSION`-ben `difficulty_id: null`, `money: 0`, `last_save_at: ""`.

## Játékmenet

1. Új játéknál a játékos nehézséget választ, a session **100 $**-ral indul.
2. A Shape Chest (**100 $**) egy véletlen alakzatot ad az inventoryba. Az alakzat értéke `base_value + 6–10` (a `base_value` jelenleg minden alakzatnál 0).
3. Az alakzatot el lehet forgatni, majd a táblára húzni.
4. **Passzív jövedelem:** a táblán lévő összes alakzat `value` értékének összege másodpercenként pénzt termel (`+X $/s` a menüsávban). Ez akkor is számít, ha a játék nincs megnyitva: betöltéskor a `last_save_at` óta eltelt idő jövedelme jóváíródik.
5. **Sortörlés jutalma:** minden kitöltött sor vagy oszlop jutalma azoknak az alakzatoknak az értékösszege, amelyeknek legalább egy cellája a sorban/oszlopban van, megszorozva ezen alakzatok számával. A sorok jutalmának összegét egy kombó szorzó szorozza (lásd `getCompletedLineReward()` a `placement.js`-nél).
6. Ha az inventory megtelt (8 elem) vagy nincs elég pénz, a láda nem nyitható.

## Adatbázis

A [db.json](../Game/json/databases/db.json) minden kulcsából a json-server végpontot csinál (`GET /SHAPE`, `PUT /SHAPE/1` stb.). A `GAME_SESSION` objektum, nem lista, ezért azt id nélkül kell lekérni és `PUT`-olni (`putDb`). Ugyanez igaz a `GAME_EVENT`-re is.

- `DIFFICULTY`: nehézségi szintek (`easy` 10×10, `normal` 8×8, `hard` 6×6), a `grid_size` adja a tábla méretét.
- `GAME_SESSION`: az aktuális játék (`difficulty_id`, `money`, `last_save_at` ISO időbélyeg). Ha a `difficulty_id` `null`, nincs aktív játék. A `money` és a `last_save_at` a `money.js` írja.
- `SHAPE`: a 7 alap tetromino (`i o t s z j l`) a cellákkal és a `base_value`-val.
- `INVENTORY_ITEM`: az inventoryban lévő alakzatok (`shape_id`, `value`, és elforgatás után `cells`). Ha nincs `cells`, az alakzat alapcelláit használja a kliens.
- `PLACEMENT`: a táblára lerakott alakzatok (`shape_id`, `value`, `cells`, `x_coord`, `y_coord`).
- `EVENT_TYPE`, `GAME_EVENT`, `BOARD_CELL`: előkészítve, de a kód még nem használja.

Az alakzatok cellái egy 4×4-es dobozon belüli `[oszlop, sor]` párok, például a T alakzat:

```js
cells: [[1,0], [0,1], [1,1], [2,1]]
```

Lerakáskor az `x_coord` és `y_coord` azt a tábla-koordinátát jelenti, ahová ennek a 4×4-es doboznak a bal felső sarka kerül. Egy cella helye a táblán így `(x_coord + oszlop, y_coord + sor)`. Mivel az alakzatok a dobozon belül nem mindig a bal felső sarokban vannak, az `x_coord` negatív is lehet.

Az `id`-k egy része string (`"0"`), a json-server által generáltak viszont számok, ezért van a kódban sok `Number(...)` és `String(...)` összehasonlítás.

## JavaScript fájlok

Az [index.html](../Game/web/www/index.html) csak a `theme.js`-t és a `game.js`-t tölti be `type="module"`-ként, a többit a `game.js` importálja (`game.js` → `popup.js`, `money.js`, `app.js`, `placement.js`).

Függőségek egy pillantásra:

```
game.js ──► popup.js ──► data.js
   ├──────► money.js ──► data.js
   ├──────► app.js ────► data.js, money.js
   └──────► placement.js ► data.js, app.js, money.js
```

A `popup.js` már nem importálja a `game.js`-t: a `game.js` callbackként adja át neki a `startGame` és `restartGame` függvényeket, így nincs körkörös import.

### [data.js](../Game/web/www/js/data.js)

A json-server felé menő `fetch` hívások egy helyen: `fetchDb`, `postDb`, `putDb` (singleton felülírása), `putDbById` és `deleteDbById`. A szerver címe a `BASE_URL`. Mind egy közös `request()` függvényre épül, ami:

- `cache: "no-store"`-ral kér, hogy ne jöjjön vissza elavult adat,
- **hibát dob**, ha a HTTP státusz nem sikeres (`GET /path -> 404 ...` formátumú üzenettel), tehát a hívóknak `try/catch`-et kell használniuk,
- üres válasznál (pl. `DELETE`) `null`-t ad vissza,
- támogatja a `keepalive` beállítást (a `putDb` harmadik paramétere), amit az oldal elhagyásakori mentés használ.

### [theme.js](../Game/web/www/js/theme.js)

A téma gomb kattintására átváltja a `<html data-theme>` értékét `dark` és `light` között, és elmenti a `localStorage`-ba. A betöltéskori témát egy kis inline script állítja be az `index.html` elején, még a CSS előtt, hogy ne villanjon be rossz téma. A színeket a [colors.css](../Game/web/www/css/colors.css) kezeli.

### [popup.js](../Game/web/www/js/popup.js)

Két függvénye van:

- `showGridPopup(onStart)` felépíti a nehézségválasztó ablakot a `DIFFICULTY` lista alapján. Egyszerre csak egy popup lehet nyitva. Amíg a nehézségek töltődnek, a start gomb tiltott; ha a szerver nem érhető el, a cím „server unreachable"-re változik. A start gomb meghívja az `onStart(difficulty)` callbacket, siker esetén bezárja az ablakot, hiba esetén újra engedélyezi a gombot (dupla kattintás ellen közben tiltva van).
- `addNewGameButton(onClick)` hozzáad egy újraindítás gombot a menühöz (`.menu-theme`), ami az átadott callbacket hívja.

### [game.js](../Game/web/www/js/game.js)

A játék indítása, újraindítása és a tábla kirajzolása:

- `loadGameSession()` megnézi, van-e mentett játék, és visszaadja a hozzá tartozó tábla méretét.
- `saveGameSession(difficulty_id)` új sessiont ment `STARTING_MONEY` (100) pénzzel, majd elindítja a pénzrendszert.
- `clearGameSession()` leállítja a pénzrendszert, megvárja a függő mentéseket (`waitForPendingSaves`), alaphelyzetbe állítja a sessiont, és törli az összes inventory elemet és lerakott alakzatot. Ha valamelyik törlés nem sikerült, hibát dob.
- `generatePlayGrid(size)` kiüríti a `#playgrid`-et és létrehoz egy `size × size` méretű rácsot `.play-cell` elemekből.
- `startGame(difficulty)` és `restartGame()` a popuphoz/gombhoz kötött belső függvények. A `restartGame` az `isRestarting` zászlóval védi magát a dupla indítástól, törli a régi állapotot (tábla, placementek, inventory), majd újra megnyitja a popupot.

Az `initGame()` induláskor vagy folytatja a mentett játékot (pénzrendszer indítása, tábla és lerakott alakzatok betöltése), vagy megnyitja a popupot.

### [money.js](../Game/web/www/js/money.js)

A pénz és a passzív jövedelem modulja. Az állapot (`money`, `passiveIncome`, `gameSession`) modulszintű változókban van, a kijelzést a menüsáv `#player-money` eleme mutatja (`123 $ | +4 $/s`).

- `startMoneySystem()` betölti a `GAME_SESSION`-t és a `PLACEMENT`-eket, kiszámolja a passzív jövedelmet, jóváírja a `last_save_at` óta eltelt idő jövedelmét, majd elindít egy másodpercenkénti `setInterval`-t. Ha nincs aktív játék (`difficulty_id` `null`), nem csinál semmit.
- `stopMoneySystem()` leállítja az időzítőt és nullázza az állapotot.
- `accrueIncome()` a legutóbbi tick óta eltelt **egész másodperceket** írja jóvá (nem a tickek számát), így akkor is helyes marad, ha a böngésző a háttérben lelassítja az időzítőt.
- `addMoney(amount)` és `spendMoney(cost)`: hozzáadás, illetve költés. A `spendMoney` `false`-t ad, ha nincs elég pénz, és hiba esetén visszaadja a levont összeget. Mindkettő elmenti a sessiont.
- `updatePassiveIncome(placements)` a lerakott alakzatok alapján újraszámolja a jövedelmet (előbb jóváírja az addig felgyűlt részt).
- `waitForPendingSaves()` megvárja a függő mentéseket. A mentések egy soron (`saveQueue`) mennek egymás után, hogy ne írják felül egymást.
- Az oldal elhagyásakor (`pagehide`) és elrejtésekor (`visibilitychange`) `keepalive`-os mentés fut, hogy ne vesszen el a felgyűlt pénz. A másodpercenkénti tick maga **nem** ment, csak a pénzt érintő műveletek és ezek az események.

### [app.js](../Game/web/www/js/app.js)

A neve félrevezető: ez az inventory és a Shape Chest modulja, nem az alkalmazás belépési pontja (érdemes lenne `inventory.js`-re nevezni).

Induláskor betölti a `SHAPE` és `INVENTORY_ITEM` listát (a `SHAPE` csak egyszer töltődik, a promise gyorsítótárazva van), és kirajzolja az inventoryt (`refreshInventory()`, ezt hívja a `game.js` és a `placement.js` is; egy token védi az elavult válaszok ellen). Minden elem egy `.inventory-item` kártya egy 4×4-es mini rácsal, az értékkel és egy forgató gombbal. A `placement.js` nem a DOM-ból olvas, hanem a `getInventoryItem(id)` exportált függvényen keresztül kapja meg a húzott elem adatait (`inventoryItemId`, `shapeId`, `value`, `cells`); a kártyán csak a `data-inventory-item-id` van.

A forgatás 90°-kal elforgatja a cellákat a 4×4-es dobozban (`[oszlop, sor] → [3 - sor, oszlop]`), és az új `cells` értéket elmenti az `INVENTORY_ITEM`-be.

A Shape Chest gomb (`SHAPE_CHEST_COST` = 100 $): a gomb tiltva van, ha már 8 elem van az inventoryban (`MAX_INVENTORY_ITEMS`). Kattintáskor levonja az árat (`spendMoney`), majd `POST`-tal elmenti az új elemet. Ha a mentés nem sikerül, visszaadja a pénzt (`addMoney`). Ha nincs elég pénz, figyelmeztetést ad.

### [placement.js](../Game/web/www/js/placement.js)

Ez a legnagyobb fájl, itt dől el, hogy az inventoryból a táblára kerül-e egy alakzat, és itt számolódik a sortörlés jutalma. Exportja: `loadPlacements()` és `resetPlacements()`. Az események bekötése importáláskor történik. Az `app.js`-ből a `refreshInventory()`-t és a `getInventoryItem()`-et, a `money.js`-ből az `addMoney()`-t és az `updatePassiveIncome()`-t használja, a `game.js`-ről nem tud.

**A tábla felismerése.** A táblát a `getBoard()` a DOM-ból olvassa ki (`.playgrid-grid > .play-cell`, a méret a cellák számának gyöke). A lerakott alakzatokat a `loadPlacements()` kéri le a `PLACEMENT` végpontról, a `renderPlacements()` pedig kirajzolja őket és feltölti az `occupied` map-et (`"oszlop,sor"` → placement id), amivel az ütközést gyorsan lehet vizsgálni. A `boardLoadToken` arra jó, hogy ha gyorsan két betöltés indul, csak az utolsó eredménye számítson. A `game.js` hívja a `loadPlacements()`-t a tábla létrehozása után, a `resetPlacements()`-t pedig újraindításkor. (A korábbi `MutationObserver` már nincs.) A szerver az igazság forrása: lerakás előtt és után mindig újratöltődnek a placementek.

**Húzás.** Az inventory `pointerdown` eseményére létrejön a `drag` objektum. Pointer Eventeket használ, így egérrel és érintéssel is ugyanúgy működik. A húzás csak 4 pixel mozgás után indul el (`DRAG_START_DISTANCE`), hogy a forgató gomb kattintása ne indítson húzást. Ekkor a `startDrag()` létrehoz egy `.drag-ghost` elemet, amit a tábla cellaméretéhez igazít (`getBoardMetrics()`), így pont akkora, mint a végleges alakzat. Egy `requestAnimationFrame` ciklus (`dragFrame`) minden képkockában:

- görgeti az oldalt, ha a kurzor a képernyő széléhez közel van,
- meghívja az `updateDrag()`-ot, ami mozgatja a ghostot, kiszámolja, melyik tábla-cellára esik az alakzat bal felső sarka (kerekítéssel, így rácshoz igazodik), és zöld vagy piros előnézetet fest a táblára.

A húzás elengedésre (`pointerup`) vagy `Escape`-re ér véget. Elengedéskor csak akkor történik lerakás, ha az utolsó előnézet érvényes volt.

**Érvényesség.** A `checkPlacement()` szerint egy lerakás akkor jó, ha az alakzat minden cellája a táblán belül van, és egyik sem foglalt.

**Lerakás.** A `dropOnBoard()` sorrendben:

1. újratölti a placementeket, és újraellenőrzi az érvényességet,
2. kiszámolja a kitöltött sorokat (`getCompletedLines`),
3. `POST`-tal elmenti a `PLACEMENT`-et, `DELETE`-tel kiveszi az `INVENTORY_ITEM`-et,
4. a törlés **előtt** kiszámolja a jutalmat (`getCompletedLineReward`), mert a törlés módosítja a placementeket,
5. törli a kész sorokat (`clearCompletedLines`), frissíti a passzív jövedelmet (`updatePassiveIncome`),
6. ha a jutalom pozitív, jóváírja (`addMoney`).

Ha valamelyik lépés elbukik, a már elmentett `PLACEMENT` visszavonódik (`deleteDbById`), hogy ne maradjon ugyanaz az alakzat egyszerre az inventoryban és a táblán, és a placementek újratöltődnek. Az `isSaving` zászló megakadályozza, hogy mentés közben új húzás induljon, a `finally` ágban pedig mindig újratöltődik az inventory.

**Sorok törlése.** A `getCompletedLines()` megnézi, mely sorok és oszlopok lennének tele az új alakzattal együtt. A `clearCompletedLines()` ezután végigmegy a lerakott alakzatokon: ha egy alakzat minden cellája törlődik, a rekordot törli, ha csak egy része, akkor frissíti a megmaradt cellákkal. Egy alakzat tehát szétdarabolódhat, de ugyanaz a rekord (és ugyanaz az `value`) marad, így a passzív jövedelme sem csökken, amíg legalább egy cellája megvan.

**Jutalom.** A `getLineReward()` egy sorra/oszlopra összegzi az abban érintett alakzatok értékét és megszorozza az alakzatok számával. A `getCompletedLineReward()` összeadja az összes kitöltött sor és oszlop jutalmát, és megszorozza a kombó szorzóval: `max(2, 1 + 0.25 · (sorok_száma − 1))`.

> Megjegyzés: a `max(2, …)` miatt a szorzó 1–5 egyszerre törölt vonalnál mindig 2, és csak 6 vagy több vonaltól nő (6 → 2,25). Ha az volt a szándék, hogy egy vonalnál ×1 legyen, és a kombó fokozatosan nőjön, akkor `max(1, …)` kell.

Bővítéskor: a lerakási szabályokat a `checkPlacement()`-be érdemes írni, a pontszámot vagy pénzt pedig a `dropOnBoard()`-ba vagy a `getCompletedLineReward()`-ba. Az alakzatméret (4) a forgatásban (`app.js`), a `SHAPE_SIZE`-ban (`placement.js`) és a CSS rácsaiban is szerepel, ezért ha változik, mindhárom helyen módosítani kell.

## HTML

Egyetlen oldal ([index.html](../Game/web/www/index.html)) három részből:

- a felső menüsáv: bal oldalt a GitHub link, középen az időzítő (`#game-timer`, egyelőre `--:--`) és a pénz (`#player-money`), jobb oldalt a téma gomb (ide teszi a `popup.js` az újraindítás gombot is),
- a `main`: bal oldalt a bolt (`#chests` a három ládával, alatta az `#inventory`), jobb oldalt a `#playgrid`, amit a JS tölt fel,
- a lábléc a készítőkkel.

Csak a Shape Chest gombnak (`#shape-chest-button`) van működése, a másik két ládáé (Upgrade 2500 $, Buff 5000 $) még nem. A Shape Chest gomb feliratát (árát) az `app.js` állítja be. A JS több elemet id vagy osztály alapján keres (`#inventory`, `#playgrid`, `#player-money`, `#shape-chest-button`, `#theme-toggle`, `.menu-theme`), ezeket ne nevezd át a JS módosítása nélkül.

## CSS

- [colors.css](../Game/web/www/css/colors.css): színpaletta és a téma változói (`--background`, `--surface`, `--accent`, `--valid`, `--invalid` stb.). A világos téma a `[data-theme="light"]` blokkban írja felül a változókat. Színt mindig változóval használj.
- [layout.css](../Game/web/www/css/layout.css): az elrendezés (flex és grid), az inventory 4×2-es rácsa, a `.game-info` sáv, a `.drag-ghost` pozícionálása.
- [style.css](../Game/web/www/css/style.css): a komponensek kinézete (gombok, `.buy-button` és tiltott állapota, inventory kártyák, tábla cellák, popup).
- [responsive.css](../Game/web/www/css/responsive.css): 768 px alatt a bolt és a tábla egymás alá kerül, 1200 px alatt az inventory kap több helyet, érintőképernyőn a húzott alakzat áttetszőbb.

A JS által kapcsolgatott osztályokat a CSS stílusozza: `play-cell-filled` (foglalt cella), `play-cell-preview-valid` és `-invalid` (előnézet húzás közben), `drag-ghost` (a mozgó alakzat), `inventory-item-dragging` (a húzott kártya) és `is-dragging` a `body`-n.

## Tennivalók

- Időzítő (`#game-timer` még helyőrző), Upgrade és Buff láda, események (`EVENT_TYPE`, `GAME_EVENT`).
- A kombó szorzó képletének felülvizsgálata (lásd a `placement.js` fejezetet).
- A `db.json` a játék közben módosul, érdemes külön tiszta alapfájlt tartani.
- A pénz mentése csak pénzt érintő műveletnél, illetve az oldal elhagyásakor történik; ha a böngésző összeomlik, a legutóbbi mentés óta felgyűlt jövedelem a `last_save_at` alapján pótlódik betöltéskor, de a mentett érték nem frissül addig.
