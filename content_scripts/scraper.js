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
        for (i in Object.values(fields))
        {
            if (window.wrappedJSObject.prev[i].id === "") {
                types[i] = "class";
                values[i] = window.wrappedJSObject.prev[i].className;
            } else {
                types[i] = "id";
                values[i] = window.wrappedJSObject.prev[i].id;
            }
        }
        let classes = {
            command: "identifiers",
            titleType: types[fields.TITLE],
            title: values[fields.TITLE],
            bodyType: types[fields.BODY],
            body: values[fields.BODY],
            nextType: types[fields.NEXT],
            next: values[fields.NEXT],
            href: getURL(window.wrappedJSObject.prev[fields.NEXT])
        }

        for (i in fieldNames) {
            if (window.wrappedJSObject.prev[i].className === '' && window.wrappedJSObject.prev[i].id === '') {
                alert("Field " + fieldNames[i] + " has no identifier, please choose again if possible");
                return;
            }
        }

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
            let title;
            let body;
            if (message.titleType == "id") {
                title = document.getElementById(message.title);
            } else {
                title = document.getElementsByClassName(message.title);
            }
            if (message.bodyType == "id") {
                body = document.getElementById(message.body);
            } else {
                body = document.getElementsByClassName(message.body);
            }
            port.postMessage({ command: "chapter", titleText: title[0].innerHTML, bodyText: body[0].innerHTML });
        } else if (message.command === "nextPage") {
            let nextButton;
            if (message.nextType == "id") {
                nextButton = document.getElementById(message.next);
            } else {
                nextButton = document.getElementsByClassName(message.next);
            }
            if (nextButton == null || nextButton[0].innerHTML == "") {
                port.postMessage({ command: "end" });
            }
            else {
                port.postMessage({ command: "newPage", url: getURL(nextButton[0]) });
            }
        }
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
        let nextText = link.innerHTML;
        return nextText.match(/href="([^"]*)/)[1];
    }

})();