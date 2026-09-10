# JSON Server

Egy könnyűsúlyú Docker image a [JSON Server](https://github.com/typicode/json-server) fake REST API-ként történő futtatásához.

Az image alapból nem tartalmaz `db.json` fájlt. Ehelyett a container indításakor adod meg, melyik JSON adatbázist szeretnéd használni. Ennek köszönhetően ugyanaz az image különböző adatbázisokkal is használható, és egyszerre több JSON Server példány is futtatható.

## Követelmények

Csak erre van szükséged:

* [Docker](https://www.docker.com/)

A Node.js és az npm telepítése **nem szükséges** a host gépre. Ezek a Docker image-en belül megtalálhatók.

## 1. A repository klónozása

Klónozd a repositoryt, majd lépj be a mappájába:

```bash
git clone <repository-url>
cd json
```

A `<repository-url>` helyére ennek a repositorynak az URL-jét írd.

Ha a repository már le van töltve, egyszerűen nyiss egy terminált a mappájában.

## 2. A Docker image létrehozása

Az image elkészítéséhez futtasd:

```bash
docker build -t json/json-alpine .
```

## 3. Adatbázis előkészítése

Hozz létre vagy használj egy tetszőleges `db.json` fájlt.

Például:

```json
{
  "users":
  [
    {
      "id": 1,
      "name": "John Pork",
      "email": "john.pork@example.com"
    },
    {
      "id": 2,
      "name": "Tripple T",
      "email": "tripple.t@example.com"
    }
  ]
}
```

Az adatbázisnak nem kell ebben a repositoryban lennie.

## 4. A szerver indítása

Indítsd el a containert a saját adatbázisoddal:

```bash
docker run -d --name json -p 3000:3000 -v "./db.json:/data/db.json" json/json-alpine /data/db.json
```

Az API ezután az alábbi címen lesz elérhető:

```text
http://localhost:3000
```

Például:

```text
http://localhost:3000/users
```

## A `docker run` parancs magyarázata

Az általános felépítés:

```text
docker run [OPTIONS] IMAGE [COMMAND]
```

### `-d`

```text
-d
```

Detached módban indítja el a containert, vagyis a háttérben fog futni.

A `-d` nélkül a terminál csatlakozva marad a container kimenetéhez.

### `--name`

```text
--name json
```

Beállítja a container nevét.

A `json` részt tetszőlegesen megváltoztathatod:

```bash
--name my-json-server
--name school-api
--name test-api
```

A nevet később olyan parancsoknál használhatod, mint:

```bash
docker stop json
docker start json
docker restart json
docker logs json
```

### `-p`

```text
-p 3000:3000
```

Összeköti a számítógéped egyik portját a container egyik portjával.

A formátum:

```text
-p HOST_PORT:CONTAINER_PORT
```

Például:

```bash
-p 3000:3000
```

jelentése:

```text
localhost:3000 → container:3000
```

Ha a `3000`-as port már használatban van, megváltoztathatod a host oldali portot:

```bash
-p 3001:3000
```

A JSON Server továbbra is a `3000`-as porton fut a containerben, de kívülről ezen a címen éred el:

```text
http://localhost:3001
```

### `-v`

```text
-v "./db.json:/data/db.json"
```

A számítógépeden található JSON fájlt bemountolja a containerbe.

A formátum:

```text
-v "HOST_PATH:CONTAINER_PATH"
```

Ebben a példában:

```text
./db.json
```

a számítógépeden található adatbázisfájl, míg:

```text
/data/db.json
```

az a hely, ahol a fájl a containeren belül elérhető lesz.

Másik helyi fájlt is használhatsz:

```bash
-v "./users.json:/data/db.json"
```

vagy:

```bash
-v "./data/products.json:/data/db.json"
```

A container mindig a `/data/db.json` helyre bemountolt fájlt fogja használni.

### Image neve

```text
json/json-alpine
```

Ez az a Docker image, amelyből a Docker létrehozza a containert.

### Adatbázis elérési útja

```text
/data/db.json
```

Ezt az útvonalat adjuk át a JSON Servernek adatbázisfájlként.

Ennek meg kell egyeznie a `-v` opciónál megadott **container oldali** útvonallal.

## 5. Több adatbázis futtatása

Ugyanazt az image-et több különböző JSON adatbázissal is használhatod egyszerre.

Például:

```bash
docker run -d --name json-users -p 3000:3000 -v "./users.json:/data/db.json" json/json-alpine /data/db.json
```

```bash
docker run -d --name json-products -p 3001:3000 -v "./products.json:/data/db.json" json/json-alpine /data/db.json
```

```bash
docker run -d --name json-orders -p 3002:3000 -v "./orders.json:/data/db.json" json/json-alpine /data/db.json
```

Ez három különálló API szervert eredményez:

```text
localhost:3000 → users.json
localhost:3001 → products.json
localhost:3002 → orders.json
```

Mindhárom esetben ugyanazt az image-et használjuk. Csak a container neve, a host oldali port és az adatbázisfájl különbözik.

## 6. Container kezelése

### Leállítás

```bash
docker stop json
```

Leállítja a containert annak eltávolítása nélkül.

### Indítás

```bash
docker start json
```

Elindít egy korábban leállított containert.

### Újraindítás

```bash
docker restart json
```

Újraindítja a containert.

### Logok megtekintése

```bash
docker logs json
```

Megjeleníti a container kimenetét.

A logok folyamatos követéséhez:

```bash
docker logs -f json
```

A követésből `Ctrl+C` segítségével léphetsz ki.

### Futó containerek megtekintése

```bash
docker ps
```

Megjeleníti a jelenleg futó containereket.

A leállított containereket is megjeleníti:

```bash
docker ps -a
```

### Container törlése

```bash
docker rm json
```

A containert először le kell állítani.

Kényszerített törlés:

```bash
docker rm -f json
```

## 7. Docker image-ek kezelése

A helyi image-ek listázása:

```bash
docker images
```

Az image törlése:

```bash
docker rmi json/json-alpine
```

Ha egy container még használja az image-et, először azt kell eltávolítani.

## Gyors használat

Ha a Docker már telepítve van, az alapvető folyamat:

```bash
git clone <repository-url>
cd json

docker build -t json/json-alpine .

docker run -d --name json -p 3000:3000 -v "./db.json:/data/db.json" json/json-alpine /data/db.json
```

A JSON API ezután elérhető:

```text
http://localhost:3000
```

---

Készítette **Laczkovics András Gergő** saját felhasználási célokra.

A README az eredeti angol verzió alapján lett fordítva AI segítségével.
