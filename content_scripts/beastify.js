fields = Object.freeze({
    TITLE: 0,
    BODY: 1,
    NEXT: 2
});

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
    function insertBeast(field) {
        document.addEventListener('click', function (e) {
            window.wrappedJSObject.prev[field] = e.target;
            switch (field) {
                case (fields.TITLE):
                    e.target.style.backgroundColor = "#FF0000";
                    break;
                case (fields.BODY):
                    e.target.style.backgroundColor = "#00FF00";
                    break;
                case (fields.NEXT):
                    e.target.style.backgroundColor = "#0000FF";
                    break;
            }
        }, { once: true });
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
            if (typeof (window.wrappedJSObject.prev) === 'undefined') {
                window.wrappedJSObject.prev = new Array(Object.keys(fields).length);
            }
            let field = message.buttonType;
            if (typeof (window.wrappedJSObject.prev[field]) !== 'undefined')
            {
                window.wrappedJSObject.prev[field].style.backgroundColor = "initial";
            }
            insertBeast(field);
        } else if (message.command === "reset") {
            removeExistingBeasts();
        }
    }

})();