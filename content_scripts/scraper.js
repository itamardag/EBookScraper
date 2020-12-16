//EBookScraper

//Copyright © 2020 Itamar Dag

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


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

    let port;
    browser.runtime.onConnect.addListener(connected);
    
    /**
     * Listen for messages from the background download script over the port.
     */
    function connected(p) {
        port = p;
        port.onMessage.addListener(handleDownloadMessage);
    }

    /** 
     * Listen for messages from the popup script.
     */
    browser.runtime.onMessage.addListener(handleElementsMessage);

    /**
     * Listen for clicks on the tab, change the background of the clicked element to a unique color for each field, and save the clicked element.
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
     * Gets identifiers of each field if possible, and posts them on the port.
     * If the field has ID it will be used, else if it has a Class it will be used.
     * If title has no identifier a generic "Chapter #num" title will be used.
     * If body has no identifier the operation fails.
     * If next has no identifier it will be searched using the tag and text content of the "next" button / link.
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
                    values[i] = window.wrappedJSObject.prev[fields.NEXT].textContent.replace(/\n| /g, "");
                    tagName = window.wrappedJSObject.prev[fields.NEXT].tagName;
                }
            }
        }

        let identifiers = { command: "identifiers", titleType: types[fields.TITLE], title: values[fields.TITLE],
            bodyType: types[fields.BODY], body: values[fields.BODY], nextType: types[fields.NEXT],
            nextTag: tagName, next: values[fields.NEXT], href: window.location.href }

        port.postMessage(identifiers);
    }

    /**
     * Handle download related messages.
     * Fetch relevant element and post the content over the port.
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

    /**
     * Get element using an identifier.
     * If identifier is ID or Class find the element using this property.
     * If identifier is content (=next button without identifier) iterate over elements with the given tag and search for the text content.
     */
    function getElement(identifier, identifierType, tagName) {
        if (identifierType === "id") {
            return document.getElementById(identifier);
        } else if (identifierType === "class") {
            return document.getElementsByClassName(identifier);
        } else if (identifierType === "content") {
            let tags = document.getElementsByTagName(tagName);
            for (i = 0; i < tags.length; i++) {
                if (tags[i].textContent.replace(/\n| /g, "") === identifier) {
                    return tags[i];
                }
            }
        }
    }

    /**
     * Get the content of an HTML element.
     * Usually the content is at element.innerHTML, but sometimes at element[0].innerHTML. If both fail, returns empty content.
     */
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
    
    /**
     * Handle element picking related messages.
     * Restore original background of the element if it was previously picked, and pick a new element.
     */
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

    /**
     * Get URL from a link html.
     * Tries href field, if it does not exist tries to get a link from "href=" content of innerHTML. If both fail, returns empty link which will end the process.
     * If the resulting link is given as "../chapter" replaces ".." with the relevant part from current URL.
     */
    function getURL(link)
    {
        let resultUrl;
        if (typeof (link.href) !== "undefined") {
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