fields = Object.freeze({
    TITLE: 0,
    BODY: 1,
    NEXT: 2
});

/**
 * Listen for clicks on the buttons, and send the appropriate message to
 * the content script in the page.
 */
function listenForClicks() {
    attemptConnection();

    document.addEventListener("click", (e) => {
        /**
         * Insert the page-hiding CSS into the active tab,
         * then get the beast URL and
         * send a "beastify" message to the content script in the active tab.
         */
        function selectContent(tabs) {
            let type = -1;
            switch (e.target.textContent) {
                case ("Title"):
                    type = 0;
                    break;
                case ("Body"):
                    type = 1;
                    break;
                case ("Next"):
                    type = 2;
                    break;
            }
            sendMessage({
                command: "selectContent",
                buttonType: type
            });
        }

        /**
         * Remove the page-hiding CSS from the active tab,
        * send a "reset" message to the content script in the active tab.
        */
        function reset(tabs) {
            sendMessage({
                command: "getFields",
            });
        }

        /**
         * Just log the error to the console.
         */
        function reportError(error) {
            console.error(`Could not scrape EBook: ${error}`);
        }

        /**
         * Get the active tab,
         * then call "beastify()" or "reset()" as appropriate.
         */
        if (e.target.classList.contains("content")) {
            browser.tabs.query({ active: true, currentWindow: true })
              .then(selectContent)
              .catch(reportError);
        }
        else if (e.target.classList.contains("reset")) {
            browser.tabs.query({ active: true, currentWindow: true })
              .then(reset)
              .catch(reportError);
        }
    });
}

/**
 * There was an error executing the script.
 * Display the popup's error message, and hide the normal UI.
 */
function reportExecuteScriptError(error) {
    document.querySelector("#popup-content").classList.add("hidden");
    document.querySelector("#error-content").classList.remove("hidden");
    console.error(`Failed to execute content script: ${error.message}`);
}


let port;
let tabId;
let folder;
let chapterNum = 0;


/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */
browser.tabs.executeScript({ file: "/content_scripts/beastify.js" })
.then(listenForClicks)
.catch(reportExecuteScriptError);

function connectToTab(tabs) {
    tabId = tabs[0].id;
    port = browser.tabs.connect(tabId);
    port.onMessage.addListener(handleMessage);
}

function onError(e) {
    console.log('Error connecting port: ${e}');
}

function attemptConnection() {
    var gettingCurrent = browser.tabs.query({
        currentWindow: true, active: true
    });
    gettingCurrent.then(connectToTab, onError);
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
            const loadingScript = browser.tabs.executeScript(tabId, { file: "/content_scripts/beastify.js" });
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

function createChapter(title, body, num)
{
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