let port;
let tabId;
let folder;
let chapterNum;
let fullBook;

function onError(e) {
    console.log('Error connecting port: ${e}');
}

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

function sendMessage(message) {
    port.postMessage(message);
}

function handleMessage(message) {
    if (message.command === "identifiers") {
        this.titleType = message.titleType;
        this.title = message.title;
        this.bodyType = message.bodyType;
        this.body = message.body;
        this.nextType = message.nextType;
        this.next = message.next;
        sendMessage({
            command: "fetchChapter",
            titleType: this.titleType,
            title: this.title,
            bodyType: this.bodyType,
            body: this.body
        });
        folder = message.href.match(/https?:\/\/(www)?([^\/]*)/)[2] + "/";
    }
    else if (message.command === "chapter") {
        let chapterText = createChapter(message.titleText, message.bodyText, ++chapterNum);
        fullBook = fullBook.concat(chapterText);
        const chapterBlob = new Blob(chapterText);
        const chapterURL = URL.createObjectURL(chapterBlob);
        browser.downloads.download({ url: chapterURL, filename: folder + "chapter " + chapterNum + " - " + message.titleText + ".html" });
        sendMessage({
            command: "nextPage",
            nextType: this.nextType,
            next: this.next
        });
    }
    else if (message.command === "newPage") {
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
    else if (message.command === "end") {
        const bookBlob = new Blob(["<fullBook>\n", fullBook, "</fullBook>\n"]);
        const bookURL = URL.createObjectURL(bookBlob);
        browser.downloads.download({ url: bookURL, filename: folder + "fullBook" + ".html" });
        window.alert("Book Download Complete!");
    }
}

function createChapter(title, body, num) {
    let preTitle = "<chapter" + num + ">\n<h2 id=\"ch" + num + "\">";
    let preBody = "</h2>\n<body>"
    let postBody = "</body>\n</chapter" + num + ">\n"
    return [preTitle, title, preBody, body, postBody];
}

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
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
    console.error(`Failed to execute content script on a loaded page: ${error.message}`);
}