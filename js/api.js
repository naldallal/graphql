/**
 * api.js
 * GraphQL query helpers for the Reboot01 platform.
 * All queries are sent to the platform's GraphQL endpoint
 * with the user's JWT as a Bearer token.
 */

const GQL_URL = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

/**
 * Send a GraphQL query.
 * @param {string} query      - GraphQL query string
 * @param {object} [variables] - Optional variables
 * @returns {Promise<object>}  - `data` field of the GQL response
 */
async function gqlQuery(query, variables = {}) {
  const token = getToken();
  if (!token) throw new Error("No JWT available.");

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired / invalid — force re-login
      logout();
    }
    throw new Error(`GQL HTTP error: ${res.status}`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    console.error("[api] GraphQL errors:", json.errors);
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

/* ─────────────────────────────────────────
   Queries
───────────────────────────────────────── */

/**
 * Fetch basic user info (name, login, campus, audit ratio, level).
 */
async function fetchUserInfo() {
  const query = `
    query {
      user {
        id
        login
        firstName
        lastName
        campus
        auditRatio
        totalUp
        totalDown
        transactions(
          where: { type: { _eq: "level" } }
          order_by: { amount: desc }
          limit: 1
        ) {
          amount
        }
      }
    }
  `;
  const data = await gqlQuery(query);
  return data.user?.[0] ?? null;
}

/**
 * Fetch XP transactions for the timeline chart.
 * Only "xp" type transactions, ordered by date ascending.
 */
async function fetchXPTransactions() {
  const query = `
    query {
      transaction(
        where: { type: { _eq: "xp" }, eventId: { _is_null: false } }
        order_by: { createdAt: asc }
      ) {
        amount
        createdAt
        object {
          name
        }
      }
    }
  `;
  const data = await gqlQuery(query);
  return data.transaction ?? [];
}

/**
 * Fetch all project results (grade) for the pass/fail chart.
 */
async function fetchProjectResults() {
  const query = `
    query {
      result(
        where: {
          object: { type: { _eq: "project" } }
          grade: { _is_null: false }
        }
        order_by: { updatedAt: desc }
      ) {
        grade
        object {
          name
        }
        updatedAt
      }
    }
  `;
  const data = await gqlQuery(query);
  return data.result ?? [];
}

/**
 * Fetch audit counts (UP / DOWN) for the audit bar chart.
 * Returns { upCount, downCount }.
 */
async function fetchAuditCounts() {
  const query = `
    query {
      upCount: transaction_aggregate(
        where: { type: { _eq: "up" } }
      ) {
        aggregate { count }
      }
      downCount: transaction_aggregate(
        where: { type: { _eq: "down" } }
      ) {
        aggregate { count }
      }
    }
  `;
  const data = await gqlQuery(query);
  return {
    upCount:   data.upCount?.aggregate?.count   ?? 0,
    downCount: data.downCount?.aggregate?.count ?? 0,
  };
}

/**
 * Fetch Piscine (JS / Go) exercise attempts.
 * Groups by exercise name and counts attempts.
 */
async function fetchPiscineAttempts() {
  const query = `
    query {
      result(
        where: {
          object: {
            type: { _eq: "exercise" }
            name: { _ilike: "%piscine%" }
          }
        }
      ) {
        object { name }
        grade
      }
    }
  `;
  const data = await gqlQuery(query);
  const results = data.result ?? [];

  // Aggregate attempt counts per exercise name
  const map = {};
  for (const r of results) {
    const name = r.object?.name ?? "Unknown";
    map[name] = (map[name] ?? 0) + 1;
  }
  return Object.entries(map)
    .map(([name, attempts]) => ({ name, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 20); // cap at 20 for readability
}

/**
 * Fetch top skills (skill XP transactions).
 * Returns [{ name, amount }] sorted by amount desc.
 */
async function fetchSkills() {
  const query = `
    query {
      transaction(
        where: { type: { _like: "skill_%" } }
        order_by: { amount: desc }
      ) {
        type
        amount
      }
    }
  `;
  const data = await gqlQuery(query);
  const txs = data.transaction ?? [];

  // Keep highest per skill type
  const map = {};
  for (const t of txs) {
    const name = t.type.replace("skill_", "").replace(/-/g, " ");
    if (!map[name] || t.amount > map[name]) map[name] = t.amount;
  }
  return Object.entries(map)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

/**
 * Fetch recent projects (name, grade, date) for the projects list.
 */
async function fetchRecentProjects() {
  const query = `
    query {
      result(
        where: {
          object: { type: { _eq: "project" } }
          grade: { _is_null: false }
        }
        order_by: { updatedAt: desc }
        limit: 8
      ) {
        grade
        object { name }
        updatedAt
      }
    }
  `;
  const data = await gqlQuery(query);
  return data.result ?? [];
}
