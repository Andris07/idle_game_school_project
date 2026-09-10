# JSON Server

A lightweight Docker image for running [JSON Server](https://github.com/typicode/json-server) as a fake REST API.

The image does not contain a default `db.json`. Instead, you provide the JSON database when starting the container. This makes it possible to use the same image with different databases and run multiple JSON Server instances at the same time.

## Requirements

You only need:

* [Docker](https://www.docker.com/)

Node.js and npm do **not** need to be installed on the host machine. They are included in the Docker image.

## 1. Clone the repository

Clone the repository and enter its directory:

```bash
git clone <repository-url>
cd json
```

Replace `<repository-url>` with the URL of this repository.

If you already have the repository, simply open a terminal in its directory.

## 2. Build the Docker image

Build the image with:

```bash
docker build -t json/json-alpine .
```

## 3. Prepare a database

Create or use any `db.json` file.

For example:

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

The database does not have to be located inside this repository.

## 4. Run the server

Start a container with your database:

```bash
docker run -d --name json -p 3000:3000 -v "./db.json:/data/db.json" json/json-alpine /data/db.json
```

The API will then be available at:

```text
http://localhost:3000
```

For example:

```text
http://localhost:3000/users
```

## Docker run command explained

The general structure is:

```text
docker run [OPTIONS] IMAGE [COMMAND]
```

### `-d`

```text
-d
```

Runs the container in detached mode, meaning it runs in the background.

Without `-d`, the container will keep the terminal attached to its output.

### `--name`

```text
--name json
```

Sets the container name.

You can change `json` to anything you want:

```bash
--name my-json-server
--name school-api
--name test-api
```

The name is later used with commands such as:

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

Maps a port on your computer to a port inside the container.

The format is:

```text
-p HOST_PORT:CONTAINER_PORT
```

For example:

```bash
-p 3000:3000
```

means:

```text
localhost:3000 → container:3000
```

You can change the host port if port `3000` is already in use:

```bash
-p 3001:3000
```

The JSON Server still runs on port `3000` inside the container, but you access it through:

```text
http://localhost:3001
```

### `-v`

```text
-v "./db.json:/data/db.json"
```

Mounts your local JSON file into the container.

The format is:

```text
-v "HOST_PATH:CONTAINER_PATH"
```

In this example:

```text
./db.json
```

is the database file on your computer, while:

```text
/data/db.json
```

is where the file appears inside the container.

You can use a different local file:

```bash
-v "./users.json:/data/db.json"
```

or:

```bash
-v "./data/products.json:/data/db.json"
```

The container will always use the file mounted to `/data/db.json`.

### Image name

```text
json/json-alpine
```

This is the Docker image that will be used to create the container.

### Database path

```text
/data/db.json
```

This is passed to JSON Server as its database file.

It must match the path used on the container side of the `-v` option.

## 5. Running multiple databases

You can run multiple JSON Server containers using the same image.

For example:

```bash
docker run -d --name json-users -p 3000:3000 -v "./users.json:/data/db.json" json/json-alpine /data/db.json
```

```bash
docker run -d --name json-products -p 3001:3000 -v "./products.json:/data/db.json" json/json-alpine /data/db.json
```

```bash
docker run -d --name json-orders -p 3002:3000 -v "./orders.json:/data/db.json" json/json-alpine /data/db.json
```

This gives you three independent API servers:

```text
localhost:3000 → users.json
localhost:3001 → products.json
localhost:3002 → orders.json
```

The image is the same in all three cases. Only the container name, host port and database file are different.

## 6. Container management

### Stop

```bash
docker stop json
```

Stops the container without removing it.

### Start

```bash
docker start json
```

Starts an existing stopped container.

### Restart

```bash
docker restart json
```

Restarts the container.

### View logs

```bash
docker logs json
```

Shows the container's output.

To follow the logs continuously:

```bash
docker logs -f json
```

Press `Ctrl+C` to stop following the logs.

### Check running containers

```bash
docker ps
```

Shows currently running containers.

To also show stopped containers:

```bash
docker ps -a
```

### Remove a container

```bash
docker rm json
```

The container must be stopped first.

You can force removal with:

```bash
docker rm -f json
```

## 7. Image management

List local images:

```bash
docker images
```

Remove the image:

```bash
docker rmi json/json-alpine
```

If a container still uses the image, remove the container first.

## Quick start

Once Docker is installed, the basic workflow is:

```bash
git clone <repository-url>
cd json

docker build -t json/json-alpine .

docker run -d --name json -p 3000:3000 -v "./db.json:/data/db.json" json/json-alpine /data/db.json
```

Your JSON API is now available at:

```text
http://localhost:3000
```

---

Created by **András Gergő Laczkovics** for personal use.

README written with the assistance of AI.
