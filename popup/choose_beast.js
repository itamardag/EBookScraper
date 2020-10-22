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

browser.runtime.onConnect.addListener(connected);

function connected(p) {
    port = p;
    port.onMessage.addListener(handleMessage);
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
            command: "fetchTitle",
            title: this.title
        });
    }
    else if (message.command === "newPage") {
        sendMessage({
            command: "fetchTitle",
            title: this.title
        });
    }
    else if (message.command === "title") {
        //todo
        sendMessage({
            command: "fetchBody",
            body: this.body
        });
    }
    else if (message.command === "body") {
        //todo
        sendMessage({
            command: "nextPage",
            next: this.next
        });
    }
    else if (message.command === "end") {
        //todo
    }
}

/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */
browser.tabs.executeScript({ file: "/content_scripts/beastify.js" })
.then(listenForClicks)
.catch(reportExecuteScriptError);