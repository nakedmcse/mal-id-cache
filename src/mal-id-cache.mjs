import { JSDOM } from "jsdom";
import fs from "fs/promises";

const SCRAPE_TIMEOUT = 15000;
const SCRAPE_RETRIES = 3;
const USER_AGENT = "Mozilla/5.0 (compatible; MALList/1.0)";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeLinks(target) {
    let retries = SCRAPE_RETRIES;
    while (retries-- > 0) {
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

            if (!response.ok) return [];

            const dom = new JSDOM(await response.text());
            const links = new Set();
            dom.window.document.querySelectorAll("a").forEach((el) => {
                links.add(el.href);
            })
            return Array.from(links).filter(l => l);
        } catch(error) {
            console.error(`Error scraping links for ${target}: ${error}`);
        }
    }
    return [];
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

async function getAnimeIdsForLetter(letter) {
    let p = 0;
    let animeIds = [];
    while (true) {
        const fullLinks = await scrapeLinks(`https://myanimelist.net/anime.php?letter=${letter}&show=${p*50}`);
        if (fullLinks.length === 0) break;
        const pageAnimeIds = fullLinks
            .filter(link => link.startsWith('https://myanimelist.net/anime'))
            .map(link => parseInt(link.split('/')[4],10));
        animeIds = [...animeIds, ...pageAnimeIds.filter(x => x)];
        p++;
        await sleep(1000);
    }
    return Array.from(new Set(animeIds));
}

async function getCharacterIdsForLetter(letter) {
    let p = 0;
    let characterIds = [];
    while (true) {
        const fullLinks = await scrapeLinks(`https://myanimelist.net/character.php?letter=${letter}&show=${p*50}`);
        if (fullLinks.length === 0) break;
        const pageCharacterIds = fullLinks
            .filter(link => link.startsWith('https://myanimelist.net/character'))
            .map(link => parseInt(link.split('/')[4],10));
        characterIds = [...characterIds, ...pageCharacterIds.filter(x => x)];
        p++;
        await sleep(1000);
    }
    return Array.from(new Set(characterIds));
}

async function saveIds(filename, idList) {
    try {
        idList.sort((a, b) => a - b);
        const output = JSON.stringify({ids: idList});
        await fs.writeFile(filename, output, 'utf8');
    } catch(error) {
        console.error(`Error saving ${filename}: ${error}`);
    }
}

async function getProducers(targets) {
    let combinedProducerIds = [];
    for (const letter of targets.split("")) {
        const letterProducerIds = await getProducerIdsForLetter(letter);
        combinedProducerIds = [...combinedProducerIds, ...letterProducerIds];
        console.log(`Read and processed ${letterProducerIds.length} producers from ${letter}`);
    }
    await saveIds('producers.json',combinedProducerIds);
    console.log(`Producer IDs written: ${combinedProducerIds.length}`);
}

async function getAnime(targets) {
    let combinedAnimeIds = [];
    for (const letter of targets.split("")) {
        const letterAnimeIds = await getAnimeIdsForLetter(letter);
        combinedAnimeIds = [...combinedAnimeIds, ...letterAnimeIds];
        console.log(`Read and processed ${letterAnimeIds.length} anime from ${letter}`);
    }
    combinedAnimeIds = Array.from(new Set(combinedAnimeIds));
    await saveIds('anime.json',combinedAnimeIds);
    console.log(`Anime IDs written: ${combinedAnimeIds.length}`);
}

async function getCharacters(targets) {
    let combinedCharacterIds = [];
    for (const letter of targets.split("")) {
        const letterCharacterIds = await getCharacterIdsForLetter(letter);
        combinedCharacterIds = [...combinedCharacterIds, ...letterCharacterIds];
        console.log(`Read and processed ${letterCharacterIds.length} characters from ${letter}`);
    }
    combinedCharacterIds = Array.from(new Set(combinedCharacterIds));
    await saveIds('characters.json',combinedCharacterIds);
    console.log(`Character IDs written: ${combinedCharacterIds.length}`);
}

async function main() {
    const TargetLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    await getProducers(TargetLetters);
    await getAnime(TargetLetters);
    await getCharacters(TargetLetters);
}

main();