'use strict';

class ExampleComponent extends HTMLElement {
    constructor () {
        super();
        console.log('ExampleComponent constructor');
    }

    createdCallback () {
        var findTemplate = function (dom, selector) {
            var foundTemplate = dom.querySelectorAll(selector);
            if (foundTemplate.length > 0) {
                return foundTemplate[ 0 ];
            }
            var links = dom.querySelectorAll('link[rel="import"]');
            for (var i = 0; i < links.length; i += 1) {
                foundTemplate = findTemplate(links[ i ].import, selector);
                if (foundTemplate !== null) {
                    return foundTemplate;
                }
            }
            return null;
        };
        var shadow = this.createShadowRoot();

        var template = this.ownerDocument.querySelector('#example-component')
            || findTemplate(this.ownerDocument.querySelector('link[rel="import"]').import, '#example-component');
        var templateInstance = this.ownerDocument.importNode(template.content, true);

        shadow.appendChild(templateInstance);
    }

    attachedCallback () {
        console.log('ExampleComponent attached');
    }

    detachedCallback () {
        console.log('ExampleComponent detached');
    }

    attributeChangedCallback (attr, oldVal, newVal) {
        console.log('ExampleComponent attribute chanaged ' + attr + ', ' + oldVal + ', ' + newVal);
    }

    yes () {
        console.log('say yes!');
    }
}

document.registerElement('example-component', {
    prototype: ExampleComponent.prototype
});

export default ExampleComponent;
