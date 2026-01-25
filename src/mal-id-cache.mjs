import { JSDOM } from "jsdom";
import fs from "fs/promises";

const SCRAPE_TIMEOUT = 15000;
const USER_AGENT = "Mozilla/5.0 (compatible; MALList/1.0)";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeLinks(target) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT);

        const response = await fetch(target, {
            signal: controller.signal,
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html",
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            return [];
        }

        const html = await response.text();
        const dom = new JSDOM(html);
        const linkElts = dom.window.document.querySelectorAll("a");
        const links = new Set();
        for (const link of linkElts) {
            links.add(link.getAttribute("href"));
        }
        return Array.from(links).filter(l => l);
    } catch(error) {
        console.error("Error scrape links", error);
        return [];
    }
}

async function getProducerIdsForLetter(letter) {
    let p = 1;
    let producerIds = [];
    while (true) {
        const fullLinks = await scrapeLinks(`https://myanimelist.net/company?letter=${letter}&p=${p}`);
        if (fullLinks.length === 0) break;
        const pageProducerIds = fullLinks
            .filter(link => link.startsWith('/anime/producer'))
            .map(link => parseInt(link.split('/')[3],10));
        producerIds = [...producerIds, ...pageProducerIds];
        p++;
        await sleep(1000);
    }
    return Array.from(new Set(producerIds));
}

async function main() {
    const TargetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let combinedProducerIds = [];
    for (const letter of TargetLetters.split("")) {
        const letterProducerIds = await getProducerIdsForLetter(letter);
        combinedProducerIds = [...combinedProducerIds, ...letterProducerIds];
        console.log(`Read and processed ${letterProducerIds.length} producers from ${letter}`);
    }

    try {
        combinedProducerIds.sort((a, b) => a - b);
        const output = JSON.stringify({ids: combinedProducerIds});
        await fs.writeFile('producers.json', output, 'utf8');
    } catch (error) {
        console.error(error);
    }
    console.log("Producer IDs written");
}

main();