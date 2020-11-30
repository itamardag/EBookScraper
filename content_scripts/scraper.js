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
        let types = new Array(Object.keys(fields).length);
        let values = new Array(Object.keys(fields).length);
        let tagName = "";
        for (i in Object.values(fields))
        {
            if (window.wrappedJSObject.prev[i].id !== "") {
                types[i] = "id";
                values[i] = window.wrappedJSObject.prev[i].id;
            } else if (window.wrappedJSObject.prev[i].className !== "") {
                types[i] = "class";
                values[i] = window.wrappedJSObject.prev[i].className;
            } else {
                if (i === fields.BODY.toString()) {
                    alert("The text body has no identifier, can't download this book");
                    return;
                }
                if (i === fields.NEXT.toString()) {
                    types[i] = "content";
                    values[i] = window.wrappedJSObject.prev[fields.NEXT].textContent;
                    tagName = window.wrappedJSObject.prev[fields.NEXT].tagName;
                }
            }
        }

        let classes = { command: "identifiers", titleType: types[fields.TITLE], title: values[fields.TITLE],
            bodyType: types[fields.BODY], body: values[fields.BODY], nextType: types[fields.NEXT],
            nextTag: tagName, next: values[fields.NEXT], href: window.location.href }

        port.postMessage(classes);
    }

    let port;
    browser.runtime.onConnect.addListener(connected);

    function connected(p) {
        port = p;
        port.onMessage.addListener(handleDownloadMessage);
    }

    /**
     * Listen for messages from the background script.
     * Call "beastify()" or "reset()".
    */

    function handleDownloadMessage(message) {
        if (message.command === "getFields") {
            startParsing();
        } else if (message.command === "fetchChapter") {
            let title = getElement(message.title, message.titleType, "");
            let body = getElement(message.body, message.bodyType, "");
            port.postMessage({ command: "chapter", titleText: getContent(title), bodyText: getContent(body) });
        } else if (message.command === "nextPage") {
            let nextButton = getElement(message.next, message.nextType, message.nextTag);
            if (typeof(nextButton) === "undefined" || getURL(nextButton) === "") {
                port.postMessage({ command: "end" });
            } else {
                port.postMessage({ command: "newPage", url: getURL(nextButton) });
            }
        }
    }

    function getElement(identifier, identifierType, tagName) {
        if (identifierType === "id") {
            return document.getElementById(identifier);
        } else if (identifierType === "class") {
            return document.getElementsByClassName(identifier);
        } else if (identifierType === "content") {
            let tags = document.getElementsByTagName(tagName);
            for (i = 0; i < tags.length; i++) {
                if (tags[i].textContent == identifier) {
                    return tags[i];
                }
            }
        }
    }

    function getContent(element) {
        if (typeof(element) === "undefined") {
            return "";
        }
        let content = element.innerHTML;
        if (typeof(content) === "undefined") {
            try {
                content = element[0].innerHTML;
            } catch (err2) {
                return "";
            }
        }
        return content;
    }

    browser.runtime.onMessage.addListener(handleElementsMessage);

    function handleElementsMessage(message) {
        if (message.command === "selectContent") {
            if (typeof (window.wrappedJSObject.prev) === 'undefined') {
                window.wrappedJSObject.prev = new Array(Object.keys(fields).length);
            }
            let field = message.buttonType;
            if (typeof (window.wrappedJSObject.prev[field]) !== 'undefined') {
                window.wrappedJSObject.prev[field].style.backgroundColor = "initial";
            }
            pickElement(field);
        }
    }

    function getURL(link)
    {
        let resultUrl;
        if (typeof (link.href !== "undefined")) {
            resultUrl = link.href;
        } else {
            let nextText = link.innerHTML;
            if (typeof (nextText) === "undefined") {
                try {
                    nextText = link[0].innerHTML;
                } catch (err2) {
                    return "";
                }
            }
            try {
                resultUrl = nextText.match(/href="([^"]*)/)[1];
            } catch (err) {
                return "";
            }
        }
        if (resultUrl.startsWith("..")) {
            return window.location.href.match(/(.*\/).+/)[1] + resultUrl.match(/.*\/(.+)/)[1];
        } else {
            return resultUrl;
        }
    }

})();