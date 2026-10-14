export const BASE_URL = `${location.protocol}//${location.hostname}:3000`;

let afterWrite = null;

export function setAfterWrite(callback)
{
    afterWrite = callback;
}

async function request(method, path, body, { keepalive = false } = {})
{
    const hasBody = body !== undefined;

    const response = await fetch(`${BASE_URL}/${path}`,
    {
        method,
        keepalive,
        cache: "no-store",
        headers:
        {
            Accept: "application/json",
            ...(hasBody && { "Content-Type": "application/json" })
        },
        body: hasBody ? JSON.stringify(body) : undefined
    });

    if (!response.ok)
    {
        throw new Error(`${method} /${path} -> ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const result = text ? JSON.parse(text) : null;

    if (method !== "GET" && path !== "GAME_SESSION" && !path.startsWith("GAME_SESSION/") && afterWrite)
    {
        try
        {
            await afterWrite();
        }
        catch (error)
        {
            // The data write already succeeded; don't make callers treat it as failed and roll it back.
            console.error(`Could not save money after ${method} /${path}: `, error);
        }
    }

    return result;
}

export const fetchDb = (dbName) => request("GET", dbName);
export const postDb = (dbName, data) => request("POST", dbName, data);
export const putDb = (dbName, data, options) => request("PUT", dbName, data, options);
export const putDbById = (dbName, id, data) => request("PUT", `${dbName}/${id}`, data);
export const deleteDbById = (dbName, id) => request("DELETE", `${dbName}/${id}`);
