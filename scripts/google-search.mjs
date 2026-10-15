#!/usr/bin/env node

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

const args = process.argv.slice(2)
const take = (name) => {
  const i = args.indexOf(name)
  return i < 0 ? undefined : args[i + 1]
}

const query = take("--query") ?? take("-q")
if (!query?.trim()) fail('Missing --query "..."')

const rawNum = take("--numResults")
const numResults = rawNum === undefined ? 8 : Number(rawNum)
if (!Number.isInteger(numResults) || numResults < 1 || numResults > 10) {
  fail("Invalid --numResults. Google Custom Search returns 1–10 results per request.")
}

const apiKey = process.env.GOOGLE_API_KEY
const cx = process.env.GOOGLE_CSE_ID
if (!apiKey) fail("Missing GOOGLE_API_KEY environment variable (GitHub Actions secret).")
if (!cx) fail("Missing GOOGLE_CSE_ID environment variable (Programmable Search Engine ID).")

const endpoint = new URL("https://www.googleapis.com/customsearch/v1")
endpoint.searchParams.set("key", apiKey)
endpoint.searchParams.set("cx", cx)
endpoint.searchParams.set("q", query)
endpoint.searchParams.set("num", String(numResults))

const res = await fetch(endpoint, { signal: AbortSignal.timeout(25000) })
const payload = await res.json().catch(() => ({}))
if (!res.ok) {
  const message = payload?.error?.message || res.statusText
  fail(`Google Search API error (${res.status}): ${message}`)
}

const items = payload.items ?? []
if (items.length === 0) {
  process.stdout.write(`No Google results found for: ${query}\n`)
  if (payload.searchInformation?.formattedSearchTime) {
    process.stdout.write(`Search time: ${payload.searchInformation.formattedSearchTime}s\n`)
  }
  process.exit(0)
}

process.stdout.write(`QUERY: ${query}\n`)
process.stdout.write(`NUM_RESULTS: ${items.length}\n`)
if (payload.searchInformation?.formattedSearchTime) {
  process.stdout.write(`SEARCH_TIME: ${payload.searchInformation.formattedSearchTime}s\n`)
}
process.stdout.write("\n")

items.forEach((item, index) => {
  process.stdout.write(`${index + 1}. ${item.title ?? "(untitled)"}\n`)
  process.stdout.write(`   URL: ${item.link ?? ""}\n`)
  if (item.snippet) process.stdout.write(`   SNIPPET: ${item.snippet.replace(/\\s+/g, " ").trim()}\n`)
  if (item.displayLink) process.stdout.write(`   DOMAIN: ${item.displayLink}\n`)
  process.stdout.write("\n")
})
