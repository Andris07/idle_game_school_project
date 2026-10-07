export const BASE_URL = `${location.protocol}//${location.hostname}:3000`;

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
    return text ? JSON.parse(text) : null;
}

export const fetchDb = (dbName) => request("GET", dbName);
export const postDb = (dbName, data) => request("POST", dbName, data);
export const putDb = (dbName, data, options) => request("PUT", dbName, data, options);
export const putDbById = (dbName, id, data) => request("PUT", `${dbName}/${id}`, data);
export const deleteDbById = (dbName, id) => request("DELETE", `${dbName}/${id}`);
