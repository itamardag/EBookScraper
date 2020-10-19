(function () {
    /**
     * Check and set a global guard variable.
     * If this content script is injected into the same page again,
     * it will do nothing next time.
     */
    if (window.hasRun) {
        return;
    }
    window.hasRun = true;

    /**
     * Given a URL to a beast image, remove all existing beasts, then
     * create and style an IMG node pointing to
     * that image, then insert the node into the document.
     */
    function insertBeast() {
        document.addEventListener('click', function (e) {
            window.wrappedJSObject.prev = e.target;
            e.target.style.backgroundColor = "#FF0000";
        }, { once: true });
    }

    function setTargetId(id) {

    }

    /**
     * Remove every beast from the page.
     */
    function removeExistingBeasts() {
        let existingBeasts = document.querySelectorAll(".beastify-image");
        for (let beast of existingBeasts) {
            beast.remove();
        }
    }

    /**
     * Listen for messages from the background script.
     * Call "beastify()" or "reset()".
    */
    browser.runtime.onMessage.addListener(handleMessage);

    function handleMessage(message) {
        if (message.command === "selectContent") {
            if (typeof (window.wrappedJSObject.prev) !== 'undefined')
            {
                window.wrappedJSObject.prev.style.backgroundColor = "initial";
            }
            insertBeast();
        } else if (message.command === "reset") {
            removeExistingBeasts();
        }
    }

})();