# 🧩 Idle Tetris – Projekt Dokumentáció és Bemutatkozás

---

## 📋 Tartalomjegyzék
1. [Projekt áttekintése](#projekt-áttekintése)
2. [A weboldal képességei és funkciói](#a-weboldal-képességei-és-funkciói)
3. [Konkrét célok a projekt végére](#konkrét-célok-a-projekt-végére)
4. [Összehasonlítás más hasonló játékokkal](#összehasonlítás-más-hasonló-játékokkal)
5. [Célcsoport és korosztályos ajánlás](#célcsoport-és-korosztályos-ajánlás)
6. [Miért érdemes ezt a játékot választani?](#miért-érdemes-ezt-a-játékot-választani)
7. [Jövőbeli fejlesztési tervek](#jövőbeli-fejlesztési-tervek)

---

## 1. Projekt áttekintése

### 🎯 Miről szól az Idle Tetris?

Az **Idle Tetris** egy egyedi koncepción alapuló **böngésző alapú stratégiai játék**, amely ötvözi a klasszikus Tetris mechanikát az **idle (inaktív) játékok** és a **szerencsejáték** elemeivel. A játékosok különböző formájú tetris elemeket helyeznek el egy rácsos táblán, miközben passzív jövedelmet termelnek, és különféle ládákból szerezhetnek fejlesztéseket, új elemeket, illetve időszakos eseményeket aktiválhatnak.

A játék lényege, hogy a lehető **legtöbb pénzt** gyűjtsd össze a stratégiai elhelyezések, a sorok/oszlopok teljesítése, valamint a ládákból nyert bónuszok okos kombinálásával. Minden döntés számít – egy rosszul elhelyezett elem vagy egy elkapkodott láda nyitás akár a játék végét is jelentheti.

---

### 🌐 Mire képes a weboldal?

A weboldal egy **teljes értékű, interaktív játékalkalmazás**, amely a következő funkciókkal rendelkezik:

| Funkció | Leírás |
|---------|--------|
| 🎮 **Játékmenet** | Valós idejű tetris elemek elhelyezése egy dinamikus rácson |
| 📊 **Nehézségi szintek** | Három nehézségi fokozat (Easy, Normal, Hard), eltérő táblaméretekkel és gazdasági paraméterekkel |
| 💰 **Passzív jövedelem** | Minden elhelyezett elem automatikusan bevételt termel |
| 🧩 **Sor/oszlop teljesítés** | Teljes sorok vagy oszlopok különleges bónuszokat aktiválnak, amelyek exponenciálisan növekedhetnek |
| 🎁 **Láda rendszer** | Háromféle láda (alakzat, fejlesztés, esemény) véletlenszerű tartalommal |
| 📦 **Raktárkészlet** | Az összes megszerzett alakzat tárolása és kezelése |
| ⏳ **Időzített események** | 5 perces vagy 20 másodperces időkorlátos bónuszok |
| 📈 **Pontszámítás** | Részletes statisztikák és pénzügyi kimutatások |
| 🔄 **Újraindítás** | Lehetőség a játék újrakezdésére anélkül, hogy a megszerzett fejlesztések elvesznének |
| 📱 **Reszponzív dizájn** | Asztali és mobil eszközökön is teljes mértékben működőképes |

---

## 2. Konkrét célok a projekt végére

A projekt fejlesztése során az alábbi **konkrét, mérhető célokat** tűztük ki magunk elé:

### 🥇 **Elsődleges célok (Alap működés)**
- [x] Teljesen működőképes játékmotor implementálása
- [x] Három nehézségi szint bevezetése eltérő táblaméretekkel
- [x] Alakzatok generálása és elhelyezése drag-and-drop vagy kattintásos mechanikával
- [x] Passzív jövedelem számítási rendszer kidolgozása
- [x] Sorok és oszlopok felismerése és bónuszok kiosztása
- [x] Háromféle láda (alakzat, fejlesztés, esemény) implementálása
- [x] Raktárkészlet rendszer létrehozása
- [x] Játék vége állapot kezelése és újraindítási lehetőség
- [x] Reszponzív felület kialakítása

### 🥈 **Másodlagos célok (Felhasználói élmény)**
- [ ] Intuitív oktatóanyag és segítségrendszer
- [ ] Hang- és vizuális visszajelzések minden interakcióhoz
- [ ] Részletes statisztikai panel (összjövedelem, legnagyobb kombó, eltelt idő stb.)
- [ ] Eredmények és teljesítmények gyűjthető rendszere
- [ ] Mentési és betöltési funkció (böngésző local storage)

### 🥉 **Harmadlagos célok (Skálázhatóság és közösség)**
- [ ] Globális ranglista implementálása (opcionális, backend függő)
- [ ] Napi kihívások rendszere
- [ ] Többjátékos mód (versenyzés vagy kooperáció)
- [ ] Egyedi alakzatok tervezésének lehetősége

---

## 3. Összehasonlítás más hasonló játékokkal

| Szempont | **Idle Tetris** | Klasszikus Tetris | Hagyományos Idle játékok | Tetris + idle kombinációk |
|----------|----------------|-------------------|--------------------------|---------------------------|
| **Játékmechanika** | Tetris elhelyezés + idle jövedelem + ládák | Csak elhelyezés és sorok törlése | Csak kattintás és várakozás | Ritkán, felületesen kombinált |
| **Stratégiai mélység** | 🔥 Magas – minden döntés számít | Közepes – gyors reakciók | Alacsony – főleg várakozás | Változó, általában sekélyes |
| **Szerencse faktor** | 🎲 Kiegyensúlyozott – ládák véletlen tartalommal | Nincs | Magas – véletlenszerű jutalmak | Általában túlzottan szerencse alapú |
| **Újrajátszhatóság** | 🌟 Kiváló – minden játék más | Jó – de ugyanaz a minta ismétlődik | Gyenge – unalmassá válik | Közepes |
| **Grafikai megjelenés** | Modern, letisztult, vizuálisan vonzó | Klasszikus, pixel art | Változó, gyakran egyszerű | Általában elavult |
| **Platform támogatás** | 💻📱 Teljesen reszponzív (böngésző) | Főleg asztali | Főleg mobilos alkalmazások | Korlátozott |
| **Tanulási görbe** | 📈 Enyhe – könnyű kezdeni, de nehéz mesterré válni | Meredek – azonnali reflexek | Nagyon alacsony | Közepes |

---

## 4. Miért jobb ez a weboldal, mint az ehhez hasonlók?

### ✅ **Egyedülálló kombináció**
Az Idle Tetris **egyedülálló módon ötvözi** a klasszikus Tetris agytornát, az idle játékok kellemes passzív fejlődését, valamint a ládák nyitogatásának izgalmát. Ez a három elem együttesen **sokkal mélyebb és változatosabb élményt** nyújt, mint bármelyik hasonló játék önmagában.

### ✅ **Valódi stratégiai döntések**
Míg más játékokban a szerencse dominál, itt a **játékos döntései** – hol helyez el egy elemet, mikor nyit egy ládát, melyik alakzatot fejleszti – **közvetlenül befolyásolják** a sikerességét. Ez különösen vonzó azok számára, akik szeretik a gondolkodós, tervezős játékokat.

### ✅ **Skálázható nehézség**
A három nehézségi szint lehetővé teszi, hogy **mindenki megtalálja a számára ideális kihívást**:
- Kezdők számára az Easy mód tökéletes a mechanikák elsajátítására.
- Haladó játékosok számára a Normal mód kiegyensúlyozott élményt nyújt.
- A Hard mód pedig **igazi próbatétel** a legelkötelezettebb játékosok számára.

### ✅ **Nincs szükség letöltésre**
Mivel a játék **teljesen böngésző alapú**, bárki, bármikor, bármilyen eszközről azonnal játszhat – regisztráció, telepítés vagy fizetés nélkül.

### ✅ **Folyamatos fejlesztés és frissítés**
A projekt nyílt végű, így a felhasználói visszajelzések alapján **folyamatosan bővíthető** új funkciókkal, eseményekkel és tartalmakkal.

---

## 5. Kiknek, milyen korosztályban ajánlott?

### 🎯 **Fókusz célcsoport: 16–35 év közötti fiatal felnőttek**

Bár a játék **alapvetően mindenki számára elérhető és élvezhető**, a következő demográfiai csoportok számára különösen ajánlott:

| Korcsoport | Ajánlás indoklása |
|------------|-------------------|
| **12–15 év** | Könnyen elsajátítható az alapmechanika; fejleszti a logikus gondolkodást és a tervezőképességet. Szülői felügyelet mellett ideális szórakozás. |
| **16–25 év** | 🔥 **PRIMER CÉLCSOPORT** – A játék stratégiai mélysége és a szerencsejáték elemek (ládák) vonzóak a fiatal felnőttek számára, akik szeretik a kihívásokat és a versenyt. |
| **26–35 év** | Másodlagos célcsoport – Azok számára ideális, akik egy-egy rövidebb, de tartalmas szünetben szeretnének kikapcsolódni, miközben aktívan használják az agyukat. |
| **36–50 év** | Harmadlagos célcsoport – A klasszikus Tetris nosztalgia és az idle mechanika nyugtató ritmusa vonzó lehet a régebbi játékosok számára is. |
| **50+ év** | Alkalmi játékosok – Egyszerű kezelőfelület, alacsony tanulási görbe, és a passzív jövedelem miatt kevésbé stresszes élmény. |

### 🧠 **Pszichológiai profil**
A játék különösen ajánlott azoknak, akik:
- Szeretik a **stratégiai és logikai** kihívásokat
- Élvezik a **gyűjtögetős, fejlesztős** játékokat
- Keresik a **rövid, de intenzív** játékélményeket
- Nyitottak a **szerencsefaktor** és a **tervezés** egyensúlyára
- Szeretnének **passzívan is fejlődni** egy játékban

---

## 6. Miért érdemes ezt a játékot választani?

### 🏆 **Versenyelőnyök más játékokkal szemben**

| Szempont | Idle Tetris előnye |
|----------|-------------------|
| **Egyediség** | Nincs másik játék, amely pontosan ezt a három műfaji elemet ilyen arányban keverné |
| **Ingyenesség** | Teljesen ingyenes, rejtett költségek vagy mikro-tranzakciók nélkül |
| **Hozzáférhetőség** | Bármilyen eszközről elérhető, nincs szükség regisztrációra |
| **Tartósság** | Magas újrajátszhatóság a véletlenszerű elemek és a különböző nehézségi szintek miatt |
| **Fejlesztői elköteleződés** | Rendszeres frissítések és közösségi visszajelzés alapú fejlesztés |
| **Oktatási érték** | Fejleszti a térbeli gondolkodást, a tervezőképességet és a kockázatkezelési készségeket |

### 💡 **Kinek ajánljuk különösen?**
- **Casual játékosoknak**, akik napi 10-15 percet szánnának egy tartalmas játékra
- **Stratégiai játékok rajongóinak**, akik szeretik a mély döntési fákat
- **Idle játékok kedvelőinek**, akik élvezik a passzív fejlődést
- **Tetris veteránoknak**, akik új kihívást keresnek a klasszikus formulában
- **Diákoknak és fiatal szakembereknek**, akik szünetekben szeretnének kikapcsolódni

---

## 📎 Összegzés

Az **Idle Tetris** nem csupán egy újabb Tetris klón vagy idle játék – ez egy **gondosan megtervezett hibrid élmény**, amely egyszerre szórakoztat, kihívást nyújt és fejleszti a stratégiai gondolkodást. A projekt célja, hogy egy **ingyenes, hozzáférhető és mély játékélményt** nyújtson minden korosztály számára, miközben folyamatosan fejlődik és alkalmazkodik a felhasználói igényekhez.