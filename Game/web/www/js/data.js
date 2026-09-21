let BASE_URL = "http://localhost:3000";

export async function fetchDb(dbName) {
    const fetchDb = await fetch(`${BASE_URL}/${dbName}`);
    const data = await fetchDb.json();
    return data;
}