export const BASE_URL = "http://localhost:3000";

export async function fetchDb(dbName)
{
    const fetchDb = await fetch(`${BASE_URL}/${dbName}`,
    {
        method: "GET",
        headers:
        {
            "Accept": "application/json"
        }
    });
    return await fetchDb.json();
}

export async function postDb(dbName, data)
{
    const postDb = await fetch(`${BASE_URL}/${dbName}`,
    {
        method: "POST",
        headers:
        {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
    return await postDb.json();
}

export async function deleteDb(dbName)
{
    const response = await fetch(`${BASE_URL}/${dbName}`,
    {
        method: "DELETE",
        headers:
        {
            "Accept": "application/json"
        }
    });
    return response.ok;
}