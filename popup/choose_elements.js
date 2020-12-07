fields = Object.freeze({
    TITLE: 0,
    BODY: 1,
    NEXT: 2
});

/**
 * Listen for clicks on the popup buttons, and send the appropriate message to
 * the content script in the page.
 */
function listenForClicks() {

    document.addEventListener("click", (e) => {
        /**
         * Sends a message to pick an element for the relevant field.
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
            browser.tabs.sendMessage(tabs[0].id, {
                command: "selectContent",
                buttonType: type
            });
        }

        /**
         * Attempts to open port between background page and content script, which also starts the nook download.
         */
        function download(tabs) {
            var page = browser.extension.getBackgroundPage();
            page.attemptConnection(tabs[0].id);
        }

        /**
         * Just log the error to the console.
         */
        function reportError(error) {
            console.error(`Could not scrape EBook: ${error}`);
        }

        /**
         * Get the active tab,
         * then call "selectContent()" or "doanload()" as appropriate.
         */
        if (e.target.classList.contains("content")) {
            browser.tabs.query({ active: true, currentWindow: true })
              .then(selectContent)
              .catch(reportError);
        }
        else if (e.target.classList.contains("download")) {
            browser.tabs.query({ active: true, currentWindow: true })
              .then(download)
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


/**
 * When the popup loads, inject a content script into the active tab,
 * and add a click handler.
 * If we couldn't inject the script, handle the error.
 */
browser.tabs.executeScript({ file: "/content_scripts/scraper.js" })
.then(listenForClicks)
.catch(reportExecuteScriptError);