fields = Object.freeze({
    TITLE: 0,
    BODY: 1,
    NEXT: 2
});

fieldNames = Object.freeze({
    0: "Title",
    1: "Body",
    2: "Next"
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
    function pickElement(field) {
        document.addEventListener('click', function (e) {
            window.wrappedJSObject.prev[field] = e.target;
            switch (field) {
                case (fields.TITLE):
                    e.target.style.backgroundColor = "#FFAAAA";
                    break;
                case (fields.BODY):
                    e.target.style.backgroundColor = "#AAFFAA";
                    break;
                case (fields.NEXT):
                    e.target.style.backgroundColor = "#AAAAFF";
                    break;
            }
        }, { once: true });
    }

    /**
     * Remove every beast from the page.
     */
    function startParsing() {
        let classes = {
            command: "classes",
            title: window.wrappedJSObject.prev[fields.TITLE].className,
            body: window.wrappedJSObject.prev[fields.BODY].className,
            next: window.wrappedJSObject.prev[fields.NEXT].className,
        }

        for (i in fieldNames) {
            if (window.wrappedJSObject.prev[i].className === '') {
                alert("Field " + fieldNames[i] + " has no class, please choose again if possible");
                return;
            }
        }

        port.postMessage(classes);
    }

    let port = browser.runtime.connect()

    /**
     * Listen for messages from the background script.
     * Call "beastify()" or "reset()".
    */
    port.onMessage.addListener(handleMessage);

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
            pickElement(field);
        } else if (message.command === "getFields") {
            startParsing();
        }
    }

})();