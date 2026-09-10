#!/usr/bin/env node
/**
 * Polls Netlify for the deploy triggered by a given commit and exits non-zero if
 * it fails. Run as the last step of the sync workflow so a single GitHub
 * notification reports on the whole chain, dashboard not required.
 */
const TOKEN = process.env.NETLIFY_AUTH_TOKEN;
const SITE_ID = process.env.NETLIFY_SITE_ID;
const COMMIT_SHA = process.env.COMMIT_SHA;

const TIMEOUT_MS = 15 * 60 * 1000;
const POLL_MS = 15 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function listDeploys() {
  const response = await fetch(
    `https://api.netlify.com/api/v1/sites/${SITE_ID}/deploys?per_page=20`,
    { headers: { Authorization: `Bearer ${TOKEN}` } }
  );
  if (!response.ok) throw new Error(`Netlify API ${response.status}`);
  return response.json();
}

async function main() {
  if (!TOKEN || !SITE_ID) {
    console.log("Netlify credentials not set, skipping the deploy check.");
    return;
  }

  const deadline = Date.now() + TIMEOUT_MS;
  let seen = null;

  while (Date.now() < deadline) {
    const deploys = await listDeploys();
    const deploy = deploys.find((item) => item.commit_ref === COMMIT_SHA);

    if (!deploy) {
      console.log(`Waiting for Netlify to pick up ${COMMIT_SHA.slice(0, 7)}…`);
    } else {
      if (deploy.state !== seen) {
        seen = deploy.state;
        console.log(`Deploy ${deploy.id} is ${deploy.state}`);
      }

      if (deploy.state === "ready") {
        console.log(`Live at ${deploy.deploy_ssl_url || deploy.deploy_url}`);
        return;
      }
      if (deploy.state === "error") {
        console.error(`Deploy failed: ${deploy.error_message || "no message"}`);
        console.error(`Log: https://app.netlify.com/sites/${SITE_ID}/deploys/${deploy.id}`);
        process.exit(1);
      }
    }

    await sleep(POLL_MS);
  }

  console.error(`Gave up after ${TIMEOUT_MS / 60000} minutes waiting on Netlify.`);
  process.exit(1);
}

main().catch((error) => {
  console.error("Netlify check failed:", error.message);
  process.exit(1);
});
