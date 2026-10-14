# 🧩 Idle Tetris: A végső stratégiai és szerencsejáték-élmény

Üdvözlünk az **Idle Tetris**-ben, a klasszikus blokkpakolós mechanika, az inaktív fejlődés és a magas tétű kockázatkezelés egyedülálló ötvözetében. Ebben a játékban minden döntés számít – attól kezdve, hogy hova helyezel egy darabot, egészen addig, hogy melyik ládát nyitod ki. A célod egyszerű, mégis nagyratörő: **minél több vagyont felhalmozni** stratégiai elhelyezéssel, időben eszközölt fejlesztésekkel és szerencsés eseménydobásokkal.

---

## 🎯 Alapfilozófia
> *"A szerencse a bátraké – de csak azoké, akik előre terveznek."*

Az Idle Tetris nem csupán a sorok eltüntetéséről szól. Hanem a **rács optimalizálásáról**, a **bevételed maximalizálásáról** és a **ládákkal való okos szerencsejátékról**, amelyek akár az egekbe repíthetik a bevételeidet, vagy arra kényszeríthetnek, hogy görcsösen keresd a szabad helyet. Akár egy laza játékos vagy, aki kikapcsolódásra vágyik, akár egy kemény stratég, a kiválasztott nehézségi szint végigkíséri az egész utadat.

---

## 🚀 Kipróbálás

A játék két Docker konténerből áll (adatbázis szerver + weboldal), a részletes indítási lépések a [fejlesztői dokumentációban](Documentations/Developer.md#futtatás) vannak. Röviden:

```bash
# adatbázis (json-server)
cd Game/json
docker build -t json/json-alpine .
docker run -d --name json -p 3000:3000 -v "./databases/db.json:/data/db.json" json/json-alpine /data/db.json

# weboldal (első alkalommal: .env-example -> .env)
cd ../web
docker compose up -d
```

A játék ezután a `http://localhost` címen érhető el. A játék állapota (pénz, készlet, tábla, futó esemény) a szerveren van, ezért az oldal frissítése vagy bezárása után is folytatható.

---

## 🎮 Játékmenet-áttekintés

### 🧱 A játékrács
A játéktér egy négyzetrács, melynek méreteit a játék elején kiválasztott nehézségi szint határozza meg. Ez a rács a vásznad, a birodalmad és a börtönöd – kezeld tisztelettel.

| Nehézség | Rácsméret | Összes cella | Stratégiai hangulat |
|------------|-----------|-------------|----------------|
| 🟢 **Könnyű** | 10x10     | 100         | Megbocsátó, tágas, ideális stratégiák tesztelésére |
| 🟡 **Normál** | 8x8       | 64          | Kiegyensúlyozott, éppen elég szűk a kihíváshoz, de elég tág a lélegzethez |
| 🔴 **Nehéz** | 6x6       | 36          | Klausztrofób, könyörtelen, csak az igazán merészeknek |

Minden játék **100 $**-ral indul.

---

### 📦 Alakzatok elhelyezése
**Tetris-alakú poliominoakat** (a klasszikus 7 forma: I, O, T, S, Z, J, L) kapsz, amelyeket a készletedből **húzással** helyezhetsz a rácsra (egérrel és érintőképernyőn is), **amennyiben van elegendő összefüggő szabad terület** az alakzat pontos formájához. Húzás közben zöld, illetve piros előnézet mutatja, hogy a lerakás érvényes-e.

- ✅ Elforgathatod az alakzatokat elhelyezés előtt.
- ❌ Elhelyezés után az alakzat **véglegesen rögzül** – nincs áthelyezés, nincs visszatérítés. Egy teljes sor vagy oszlop törlésekor az alakzatnak csak a törölt cellái tűnnek el, a maradék a helyén marad.
- 🧠 A stratégiai elhelyezés kulcsfontosságú: hagyj helyet a jövőbeli értékes daraboknak, és tervezz sor-/oszlopkiegészítési kombókat.

---

### 💰 Passzív jövedelem és értékrendszer
Minden egyes elhelyezett alakzat **passzív jövedelmet** termel: a táblán lévő alakzatok értékének összege **másodpercenként** íródik jóvá (a menüsávban látható: `pénz | +X $/s`). A jövedelem akkor is gyűlik, amikor a játék nincs megnyitva – visszatéréskor a távollét idejére járó pénz is jóváíródik.

- **Érték:** egy alakzat értéke a megszerzésekor dől el: az alakzat típusának aktuális **alapértéke** (kezdetben 0, a fejlesztőládák növelik) **plusz egy véletlen 6–10 közötti szám**. Két egyforma kinézetű darab gazdasági potenciálja így eltérő lehet.
- Az érték **a darabbal marad**: egy később megemelt alapérték nem változtatja meg a már megszerzett alakzatok értékét.
- Ha egy alakzatnak csak egy része törlődik sortörléskor, az **értéke teljes egészében megmarad**, és addig termel, amíg legalább egy cellája a táblán van.

---

### 🧩 Sor- és oszlopkiegészítés – Az igazi pénzkereső
Itt válik az Idle Tetris a passzív gyűjtögetésből **kombóvadász adrenalinlöketé**.

- Amikor **kitöltesz egy teljes sort** (az összes cella megtelt), a játék kiszámolja **az adott sorban lévő összes alakzat összértékét** (minden alakzatot, aminek legalább egy cellája a sorban van), és megszorozza azon alakzatok számával. A sor ezután eltűnik, és a jutalom azonnal jóváíródik.
- Ugyanez vonatkozik az **oszlopokra** – egy teljes oszlop hasonló jutalomszámítást indít el.
- **🔥 KOMBÓ BÓNUSZ 🔥** – Ha egyetlen elhelyezéssel **több sort és/vagy oszlopot** is kitöltesz, a jutalmak összeadódnak, és az összeget egy kombó szorzó növeli: a szorzó **legalább ×2**, és ha 6 vagy több vonal törlődik egyszerre, vonalanként további +0,25-del nő (`max(2, 1 + 0,25 · (vonalak − 1))`).

  Egy nagy kombó **rendkívüli nyereményeket** eredményezhet – de ehhez mesteri tervezés és egy kis szerencse szükséges.

---

### 💀 Játék vége feltétel
Ha a készleted **megtelt (8 alakzat)**, és **egyik alakzatnak sincs már érvényes helye** a táblán (egyik elforgatásban sem), **a játék véget ér**. Egy összegző ablak mutatja a nehézséget, a pénzedet és a játékidőt, majd új játékot kezdhetsz. Amíg fut az Időbefagyasztás esemény, a játék nem érhet véget, mert a végén a rács felszabadul.

---

## 🎁 A három láda – Az út a gazdagsághoz

A ládák az Idle Tetris szívét jelentik. Ezek megvásárolhatók játékbeli valutáért, és minden kinyitás eredményét egy felugró ablak mutatja. Mindegyik láda más-más célt szolgál, és más-más ízű kockázat-jutalom dinamikát kínál.

| Láda | Ár | Mit ad? |
|------|----|---------|
| 🟦 **Alakzatláda** (Shape Chest) | 100 $ | Egy véletlen alakzatot a készletbe |
| 🟧 **Fejlesztőláda** (Upgrade Chest) | 2500 $ | Egy véletlen alakzattípus alapértékét növeli |
| 🟪 **Eseményláda** (Buff Chest) | 5000 $ | Egy véletlen, időzített eseményt indít |

---

### 🟦 1. láda – Az alakzatláda *(Tetromino-arszenál)*
Ez a láda **egy véletlenszerű Tetris-alakzatot** ad a készletedhez (ha a készlet megtelt, a gomb le van tiltva).

- **Ritkaságeloszlás:** Minden alakzatnak egyenlő esélye van a megjelenésre (egyenletes valószínűség).
- **Értékváltozatosság:** Még az egyforma alakzatok között is **az értékük** véletlenszerű: az alakzattípus aktuális alapértéke + 6–10.
- **Stratégiai felhasználás:** Gyűjts nagy értékű darabokat sor-/oszlopkiegészítésekhez, vagy használj olcsókat a hézagok kitöltésére és a kombók erőltetésére.

---

### 🟧 2. láda – A fejlesztőláda *(Erősítő páncélszekrény)*
Ez a láda **egy véletlenszerűen kiválasztott alap alakzattípus** (I, O, T, S, Z, J vagy L) **alapértékét** növeli meg **10 és 50 közötti** véletlen összeggel. A felugró ablak megmutatja, melyik alakzat fejlődött, és mennyivel.

- **Csak az új alakzatokra hat:** a fejlesztés után kinyitott alakzatok kapják az emelt alapértéket. A készletedben lévő és a már lerakott alakzatok értéke nem változik.
- **Halmozódik:** ugyanaz az alakzattípus többször is fejlődhet, így a szerencsés típus egyre értékesebb darabokat ad.
- **Kockázat:** nem te választod ki, melyik típus fejlődik, és a fejlesztés új játékig megmarad. Új játék indításakor az alapértékek nullázódnak.

---

### 🟪 3. láda – Az eseményláda *(Káosz-katalizátor)*
Ez a láda **egy véletlenszerűen kiválasztott (egyenként 25% eséllyel) ideiglenes globális eseményt** indít el, amely hatással van a játékra és a bevételeidre. Az esemény a felugró ablak bezárásakor indul, a hátralévő idő a menüsávban látható az esemény ikonja mellett.

| Esemény neve | Hatás | Időtartam |
|------------|--------|----------|
| 💰 **Aranyláz** | Minden passzív jövedelem megszorzódik 2x-el | 5 perc |
| 🌀 **Dupla alakzat** | Minden kinyitott alakzat egy azonos másolatot generál a készletedben (amennyiben van hely) | 1 perc |
| ⏳ **Időbefagyasztás** | A kész sorok/oszlopok nem tűnnek el, csak a fagyás végén törlődnek, és **egyetlen kombóként** fizetődnek ki | 30 másodperc |
| 📈 **Értékrobbanás** | Az összes sor-/oszlopkiegészítési jutalom 50%-kal nő | 3 perc |

- **Egyszerre egy esemény:** amíg egy esemény fut, az Eseményláda le van tiltva.
- **Szerver oldali:** a futó esemény elmentődik, így az oldal újratöltése után is folytatódik (az Aranyláz a távollét idejére is számít).
- **Stratégia:** Időzítsd jól az eseményládák nyitását – egy Értékrobbanás aktiválása egy nagy sor-/oszlopkombó előtt, vagy egy Időbefagyasztás alatt gondosan felépített, több vonalas kombó csillagászati hozamokat eredményezhet.

---

## 🎒 A készlet – A stratégiai arzenálod

Minden alakzat, amelyet az 1. ládából szerzel, a **készletedben** tárolódik, 8 tárolóegységben, amely mutatja:

- Az alakzat formáját (és forgató gombot)
- Az alakzat értékét (ennyivel járul hozzá a másodpercenkénti bevételhez, ha lerakod)

**Fő szabályok:**
- Az alakzatokat **bármilyen sorrendben** és bármikor elhelyezheted.
- **Nincs időkorlát** arra vonatkozóan, hogy mikor kell elhelyezned egy alakzatot.
- Nem törölhetsz vagy dobhatsz el alakzatokat – a készletből csak a táblára helyezéssel szabadíthatsz fel helyet. Az alakzatok értékét nem lehet egyenként fejleszteni, csak a típusok alapértékét a Fejlesztőláda segítségével.

---

## ⚙️ Nehézségi skálázás – Válaszd ki a kihívást

A nehézségi választásod a rács méretét határozza meg, ami közvetlenül hat a játék vége kockázatára és arra, hogy mennyire nehéz kombókat építeni.

| Szempont | Könnyű | Normál | Nehéz |
|--------|------|--------|------|
| Rácsméret | 10x10 | 8x8 | 6x6 |
| Játék vége kockázat | Alacsony | Közepes | Magas |

**Javaslat:** Kezdd Könnyűn a mechanikák elsajátításához, majd lépj tovább Normálra a kiegyensúlyozott élményért, végül hódítsd meg a Nehéz szintet a képességeid és szerencséd végső próbájaként.

---

## 🧠 Haladó stratégiák tapasztalt játékosoknak

- **Sarokpakolás:** Helyezz nagy értékű darabokat a sarkokba, hogy maximalizáld a sor-/oszlopkiegészítési potenciált.
- **Hézagkezelés:** Hagyj szándékosan réseket, hogy a jövőbeli darabokat kombólehetőségekbe tereld.
- **Korai fejlesztés:** A Fejlesztőláda hatása csak az utána szerzett alakzatokra érvényes, ezért érdemes az Alakzatládák előtt megvenni.
- **Eseményláncolás:** Nyiss egy eseményládát közvetlenül egy nagy kombó előtt, hogy megsokszorozd a lendületed. Az Időbefagyasztás alatt a kész vonalak a fagyás végén egyetlen nagy kombóként fizetődnek ki.
- **Készletgazdálkodás:** Tarts egy keveréket olcsó töltelékdarabokból és drága erődarabokból, hogy bármilyen rácsállapothoz alkalmazkodni tudj, és ne hagyd, hogy a készlet megteljen olyan alakzatokkal, amelyek már nem férnek el a táblán.

---

## 🏆 Végjáték

Miután elsajátítottad az alapokat, tűzz ki csillagokat célul:
- **Magas pontszám:** Maximalizáld a teljes vagyonodat, mielőtt a rács megtelik.
- **Speedrun:** Szerezz minél több pénzt Nehéz nehézségen 10 percen belül.
- **Tökéletes rács:** Miután feltöltötted a rácsot, próbáld meg az összes alakzatot eltüntetni, hogy üres maradjon a rács.

---

## 🙌 Befejező gondolatok

Az Idle Tetris a **türelem, a precizitás és egy csipetnyi szerencse** játéka. Minden egyes láda, amit kinyitsz, minden darab, amit elhelyezel, és minden sor, amit eltüntetsz, közelebb visz ahhoz, hogy igazi Tetris-királlyá válj. A rács a vásznad – fesd meg bölcsen.

> *"A legjobb játékosok nemcsak reagálnak – felkészülnek."*

Most pedig indulj, helyezd el a blokkjaidat, és legyen a véletlenszám-generátor mindig a javadra.

---

## 📚 Dokumentáció

- [Játékkoncepció és projekt-bemutatkozás](Documentations/Game_Concept.md)
- [Adatbázis (ER diagram és táblák)](Documentations/SQL_Diagram.md)
- [Fejlesztői dokumentáció](Documentations/Developer.md)
- [Webszerver (NGiNX + PHP)](Game/web/README.md) és [json-server](Game/json/README.md)

---

**🎮 Készen állsz a játékra? Válassz nehézségi szintet, nyisd ki az első ládádat, és kezd el az utadat az inaktív vagyon felé!**
