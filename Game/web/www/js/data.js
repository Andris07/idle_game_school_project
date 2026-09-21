let BASE_URL = "http://localhost:3000";

export async function fetchDb(dbName) {
    const fetchDb = await fetch(`${BASE_URL}/${dbName}`,{
        method: "GET",
        headers: {
            "Accept": "application/json"
        }
    });
    return await fetchDb.json();
}