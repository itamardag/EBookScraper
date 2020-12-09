//EBookScraper

//Copyright © 2020 Itamar Dag

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


let port;
let tabId;
let folder;
let chapterNum;
let fullBook;

function onError(e) {
    console.log('Error connecting port: ${e}');
}

/**
 * Attempts connection to content script through a port.
 */
function attemptConnection(tab) {
    fullBook = [];
    chapterNum = 0;
    tabId = tab;
    port = browser.tabs.connect(tabId);
    port.onMessage.addListener(handleMessage);
    sendMessage({
        command: "getFields",
    });
}

/**
 * Sends message to content script through the port.
 */
function sendMessage(message) {
    port.postMessage(message);
}

/**
 * Listens for messages and calls the relevant message function based on the command.
 */
function handleMessage(message) {
    if (message.command === "identifiers") {
        identifiersMessage(message);
    }
    else if (message.command === "chapter") {
        chapterMessage(message);
    }
    else if (message.command === "newPage") {
        newPageMessage(message);
    }
    else if (message.command === "end") {
        endMessage(message);
    }
}

/**
 * Extracts the data from identifiers message and sends the command to fetch a chapter.
 */
function identifiersMessage(message) {
    this.titleType = message.titleType;
    this.title = message.title;
    this.bodyType = message.bodyType;
    this.body = message.body;
    this.nextType = message.nextType;
    this.nextTag = message.nextTag;
    this.next = message.next;
    folder = message.href.match(/https?:\/\/(www.)?([^\/]*)/)[2] + "/"; // matches the part between www. and the first /
    sendMessage({
        command: "fetchChapter",
        titleType: this.titleType,
        title: this.title,
        bodyType: this.bodyType,
        body: this.body
    });
}

/**
 * Extracts, formats and downloads the data from chapter message, adds it to the full book, and sends the command to load the next chapter.
 */
function chapterMessage(message) {
    let chapterText = createChapter(message.titleText, message.bodyText, ++chapterNum);
    fullBook = fullBook.concat(chapterText);
    const chapterBlob = new Blob(chapterText);
    const chapterURL = URL.createObjectURL(chapterBlob);
    let titleText = message.titleText.replace(/\n/g, " ");
    titleText = titleText.replace(/<.*>/g, "");
    titleText = titleText.replace(/\/|\\|\?|\*|\||"|:/g, ""); // delete illegal text for file name
    browser.downloads.download({ url: chapterURL, filename: folder + "chapter " + chapterNum + " - " + titleText + ".html" });
    sendMessage({
        command: "nextPage",
        nextType: this.nextType,
        nextTag: this.nextTag,
        next: this.next
    });
}

/**
 * Loads a new page and inserts the content script, then sends the command to fetch a chapter.
 */
function newPageMessage(message) {
    const loadingTab = goToUrl(tabId, message.url)
    loadingTab.then(function f(tabInfo) {
        const loadingScript = browser.tabs.executeScript(tabId, { file: "/content_scripts/scraper.js" });
        loadingScript.then(function f() {
            port = browser.tabs.connect(tabId);
            port.onMessage.addListener(handleMessage);
            sendMessage({
                command: "fetchChapter",
                titleType: this.titleType,
                title: this.title,
                bodyType: this.bodyType,
                body: this.body
            });
        })
        .catch(reportExecuteScriptError);
    });
}

/**
 * Downloads the full book.
 */
function endMessage(message) {
    const bookBlob = new Blob(["<fullBook>\n", fullBook, "</fullBook>\n"]);
    const bookURL = URL.createObjectURL(bookBlob);
    browser.downloads.download({ url: bookURL, filename: folder + "fullBook" + ".html" });
    window.alert("Book Download Complete!");
}

/**
 * Formats title text, body html and chapter num to chapter html.
 */
function createChapter(title, body, num) {
    let preTitle = "<chapter" + num + ">\n<h2 id=\"ch" + num + "\">";
    let preBody = "</h2>\n<body>"
    let postBody = "</body>\n</chapter" + num + ">\n"
    return [preTitle, title, preBody, body, postBody];
}

/** 
 * Asyncronously loads the given url to the given tab.
 * Rteurns a promise that runs resolve after the tab has finished loading.
 */
function goToUrl(tab, url) {
    browser.tabs.update(tab, { url });
    return new Promise(resolve => {
        browser.tabs.onUpdated.addListener(function onUpdated(id, info) {
            if (id === tab && info.status === 'complete') {
                browser.tabs.onUpdated.removeListener(onUpdated);
                resolve();
            }
        });
    });
}

/**
 * There was an error executing the script.
 */
function reportExecuteScriptError(error) {
    console.error(`Failed to execute content script on a loaded page: ${error.message}`);
}