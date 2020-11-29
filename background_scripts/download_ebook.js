let port;
let tabId;
let folder;
let chapterNum = 0;

function onError(e) {
    console.log('Error connecting port: ${e}');
}

function attemptConnection(tab) {
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
    if (message.command === "classes") {
        this.title = message.title;
        this.body = message.body;
        this.next = message.next;
        sendMessage({
            command: "fetchChapter",
            title: this.title,
            body: this.body
        });
        folder = message.href.match(/https?:\/\/(www)?([^\/]*)/)[2] + "/";
    }
    else if (message.command === "chapter") {
        const chapterBlob = new Blob(createChapter(message.titleText, message.bodyText, ++chapterNum));
        const chapterURL = URL.createObjectURL(chapterBlob);
        browser.downloads.download({ url: chapterURL, filename: folder + "chapter " + chapterNum + " - " + message.titleText + ".html" });
        sendMessage({
            command: "nextPage",
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
                    title: this.title,
                    body: this.body
                });
            })
            .catch(reportExecuteScriptError);
        });
    }
    else if (message.command === "end") {
        window.alert("Book Download Complete!");
    }
}

function createChapter(title, body, num) {
    let preTitle = "<chapter" + num + ">\n<h2 id=\"ch" + num + "\">";
    let preBody = "</h2>\n<body>"
    let postBody = "</body>\n</chapter" + num + ">"
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
    //document.querySelector("#popup-content").classList.add("hidden");
    //document.querySelector("#error-content").classList.remove("hidden");
    console.error(`Failed to execute content script on a loaded page: ${error.message}`);
}