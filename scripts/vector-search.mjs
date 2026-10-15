#!/usr/bin/env node

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const required = (name, value) => {
  if (!value?.trim()) fail(`Missing required input: ${name}`)
  return value.trim()
}

const action = required("VECTOR_ACTION", process.env.VECTOR_ACTION)
const project = required("GCP_PROJECT_ID", process.env.GCP_PROJECT_ID)
const location = required("GCP_LOCATION", process.env.GCP_LOCATION)
const token = required("GOOGLE_ACCESS_TOKEN", process.env.GOOGLE_ACCESS_TOKEN)
const apiVersion = process.env.VECTOR_API_VERSION || "v1"
if (!["v1", "v1beta"].includes(apiVersion)) fail("VECTOR_API_VERSION must be v1 or v1beta.")

const parent = `projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}`
const base = `https://vectorsearch.googleapis.com/${apiVersion}/${parent}`
const collectionId = process.env.COLLECTION_ID?.trim()
const dataObjectId = process.env.DATA_OBJECT_ID?.trim()
const collectionPath = collectionId ? `${base}/collections/${encodeURIComponent(collectionId)}` : ""
const objectPath = dataObjectId ? `${collectionPath}/dataObjects/${encodeURIComponent(dataObjectId)}` : ""

const parseJson = (name, raw, fallback) => {
  if (raw === undefined || raw === "") return fallback
  try { return JSON.parse(raw) } catch { fail(`${name} must be valid JSON.`) }
}

const body = parseJson("REQUEST_BODY_JSON", process.env.REQUEST_BODY_JSON, {})
const vector = parseJson("VECTOR_VALUES_JSON", process.env.VECTOR_VALUES_JSON, [])
const topK = Number(process.env.TOP_K || 10)
const searchField = process.env.SEARCH_FIELD?.trim()
const updateMask = process.env.UPDATE_MASK?.trim()

let method = "GET"
let url
let requestBody

switch (action) {
  case "list-collections":
    url = `${base}/collections`
    break
  case "get-collection":
    if (!collectionId) fail("COLLECTION_ID is required for get-collection.")
    url = collectionPath
    break
  case "create-collection":
    url = `${base}/collections?collectionId=${encodeURIComponent(required("COLLECTION_ID", collectionId))}`
    method = "POST"
    requestBody = body
    break
  case "delete-collection":
    if (!collectionId) fail("COLLECTION_ID is required for delete-collection.")
    url = collectionPath
    method = "DELETE"
    break
  case "query-data-objects":
    if (!collectionId) fail("COLLECTION_ID is required for query-data-objects.")
    url = `${collectionPath}/dataObjects:query`
    method = "POST"
    requestBody = body
    break
  case "get-data-object":
    if (!collectionId || !dataObjectId) fail("COLLECTION_ID and DATA_OBJECT_ID are required for get-data-object.")
    url = objectPath
    break
  case "create-data-object":
    if (!collectionId || !dataObjectId) fail("COLLECTION_ID and DATA_OBJECT_ID are required for create-data-object.")
    url = `${collectionPath}/dataObjects?dataObjectId=${encodeURIComponent(dataObjectId)}`
    method = "POST"
    requestBody = body
    break
  case "update-data-object":
    if (!collectionId || !dataObjectId) fail("COLLECTION_ID and DATA_OBJECT_ID are required for update-data-object.")
    if (!updateMask) fail("UPDATE_MASK is required for update-data-object (for example: data,vectors).")
    url = `${objectPath}?updateMask=${encodeURIComponent(updateMask)}`
    method = "PATCH"
    requestBody = body
    break
  case "delete-data-object":
    if (!collectionId || !dataObjectId) fail("COLLECTION_ID and DATA_OBJECT_ID are required for delete-data-object.")
    url = objectPath
    method = "DELETE"
    break
  case "vector-search":
    if (!collectionId) fail("COLLECTION_ID is required for vector-search.")
    if (!searchField) fail("SEARCH_FIELD is required for vector-search.")
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
      fail("VECTOR_VALUES_JSON must be a non-empty JSON array of numbers, e.g. [0.1,0.2,0.3].")
    }
    if (!Number.isInteger(topK) || topK < 1 || topK > 1000) fail("TOP_K must be an integer from 1 to 1000.")
    url = `${collectionPath}/dataObjects:search`
    method = "POST"
    requestBody = {
      vector_search: {
        search_field: searchField,
        vector: { values: vector },
        top_k: topK,
        output_fields: { data_fields: "*", vector_fields: "*", metadata_fields: "*" }
      }
    }
    break
  default:
    fail(`Unsupported VECTOR_ACTION: ${action}`)
}

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/json"
}
if (requestBody !== undefined) headers["Content-Type"] = "application/json"

const response = await fetch(url, {
  method,
  headers,
  ...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
  signal: AbortSignal.timeout(60000)
})
const responseText = await response.text()
let payload
try { payload = responseText ? JSON.parse(responseText) : {} } catch { payload = responseText }

if (!response.ok) {
  const detail = typeof payload === "object" ? payload?.error?.message || JSON.stringify(payload) : payload
  fail(`Vector Search API error (${response.status} ${response.statusText}): ${detail}`)
}

process.stdout.write(`VECTOR_ACTION: ${action}\nHTTP_STATUS: ${response.status}\n`)
process.stdout.write(typeof payload === "string" ? payload + "\n" : JSON.stringify(payload, null, 2) + "\n")
